// #ifdef XULAPP
function PersistantCache(name)
{
    var file = Components.classes["@mozilla.org/file/directory_service;1"].
        getService(Components.interfaces.nsIProperties).
        get("ProfD", Components.interfaces.nsIFile);

    var fileCacheDir = file.clone();
    fileCacheDir.append(name+"Files");
    this.fileCacheDir = new File(fileCacheDir);

    file.append(name+".sqlite");

    var storageService = Components.classes["@mozilla.org/storage/service;1"].
        getService(Components.interfaces.mozIStorageService);

    this.db = storageService.openDatabase(file);
    var userVersionStmt = this.db.createStatement("PRAGMA user_version");
    if (!userVersionStmt.executeStep())
        throw new GenericError("Unable to access PersistantCache database");

    var version = userVersionStmt.getInt32(0);
    userVersionStmt.reset();

    if (version > 1999)
        throw new GenericError("Unrecognized PersistantCache database version");

    this.db.createFunction("deleteFile", 1, new StorageFunctionDelete());
try{
    if (version == 0)
        this.db.executeSimpleSQL(<sql>
    BEGIN IMMEDIATE TRANSACTION;

    CREATE TABLE cache (key TEXT PRIMARY KEY, value TEXT, expiry_date INT(8), is_file INT(1));
    CREATE TABLE removed_files (file TEXT);

    CREATE TRIGGER clean_insert_before BEFORE INSERT ON cache
    BEGIN
        INSERT INTO removed_files
            SELECT value FROM cache WHERE key = new.key AND is_file = 1;
    END;

    CREATE TRIGGER clean_insert_after AFTER INSERT ON cache
    BEGIN
        SELECT deleteFile(file) FROM removed_files WHERE NOT
            EXISTS (SELECT 1 FROM cache WHERE value = file);
        DELETE FROM removed_files;
    END;

    CREATE TRIGGER clean_update AFTER UPDATE ON cache WHEN old.is_file = 1
    BEGIN
        SELECT deleteFile(old.value) WHERE NOT
            EXISTS (SELECT 1 FROM cache WHERE value = old.value);
    END;

    CREATE TRIGGER clean_delete AFTER DELETE ON cache WHEN old.is_file = 1
    BEGIN
        SELECT deleteFile(old.value) WHERE NOT
            EXISTS (SELECT 1 FROM cache WHERE value = old.value);
    END;

    PRAGMA user_version = 1001;

    COMMIT TRANSACTION;
        </sql>.toString());
    else
        this.db.executeSimpleSQL("DELETE FROM cache WHERE expiry_date < "+Date.now());
}catch(ex){alert(this.db.lastErrorString); throw ex}
    this.getStmt = this.db.createStatement("SELECT value, is_file, expiry_date FROM cache "+
                                      "WHERE key = ?1");
    this.setStmt = this.db.createStatement("REPLACE INTO cache (key, value, is_file, "+
                                           "expiry_date) VALUES(?1, ?2, ?3, ?4)");
    this.removeStmt = this.db.createStatement("DELETE FROM cache WHERE key = ?1");
    this.bumpStmt = this.db.createStatement("UPDATE cache SET expiry_date = ?2 WHERE key = ?1");
    this.clearStmt = this.db.createStatement("DELETE FROM cache");
    this.iteratorStmt = this.db.createStatement("SELECT key, value, is_file FROM cache WHERE key LIKE ?1");
    this.keyIteratorStmt = this.db.createStatement("SELECT key FROM cache WHERE key LIKE ?1");
}

_DECL_(PersistantCache).prototype =
{
    setValue: function(key, value, expiryDate, storeAsFile)
    {
        if (storeAsFile) {
            if (!this.fileCacheDir.exists)
                this.fileCacheDir.createDirectory();

            var file;

            do {
                file = new File(this.fileCacheDir, generateRandomName("10"));
                try {
                    file.open(null, 0x02|0x08|0x80);
                } catch (ex) { file = null; }

            } while (!file);

            file.write(value);
            value = file.path;
        }
        this.setStmt.bindStringParameter(0, key);
        this.setStmt.bindStringParameter(1, value);
        this.setStmt.bindInt32Parameter(2, storeAsFile ? 1 : 0);
        this.setStmt.bindInt64Parameter(3, expiryDate ? expiryDate.getTime() : 0x7fffffffffff);
        this.setStmt.execute();

        return value;
    },

    getValue: function(key, asFile)
    {
        this.getStmt.bindStringParameter(0, key);
        if (!this.getStmt.executeStep()) {
            this.getStmt.reset();
            return null;
        }
        if (this.getStmt.getInt64(2) < Date.now()) {
            this.getStmt.reset();
            this.db.executeSimpleSQL("DELETE FROM cache WHERE expiry_date < "+Date.now())
            return null;
        }

        var value = this.getStmt.getString(0);
        var type = this.getStmt.getInt32(1);
        this.getStmt.reset();

        if (type) {
            if (!asFile)
                return slurpFile(value);
            return "file://"+value;
        } else if (asFile)
            throw new GenericError("Unable to return data as file path");

        return value;
    },

    removeValue: function(key)
    {
        this.removeStmt.bindStringParameter(0, key);
        this.removeStmt.execute();
    },

    bumpExpirationDate: function(key, expiryDate)
    {
        this.bumpStmt.bindStringParameter(0, key);
        this.bumpStmt.bindInt64Parameter(1, expiryDate.getTime());
        this.bumpStmt.execute();
    },

    clear: function()
    {
        this.clearStmt.execute();
    },

    iterator: function(prefix, asFile)
    {
        return {
            prefix: prefix+"%",
            asFile: asFile,
            stmt: this.iteratorStmt,
            keyStmt: this.keyIteratorStmt,

            __iterator__: function(onlyKeys) {
                if (onlyKeys) {
                    try {
                        this.keyStmt.bindStringParameter(0, this.prefix);
                        while (this.keyStmt.executeStep())
                            yield (this.keyStmt.getString(0));
                    } finally {
                        this.keyStmt.reset();
                    }
                } else
                    try {
                        this.stmt.bindStringParameter(this.prefix);
                        while (this.stmt.executeStep()) {
                            var value = this.getStmt.getString(1);

                            if (this.getStmt.getInt32(2)) {
                                if (!asFile)
                                    value = slurpFile(value);
                                else
                                    value = "file://"+value;
                            } else if (asFile)
                                continue;

                            yield ([this.stmt.getString(0), value]);
                        }
                    } finally {
                        this.stmt.reset();
                    }
            }
        };
    }
}

function StorageFunctionDelete()
{
}

_DECL_(StorageFunctionDelete).prototype =
{
    onFunctionCall: function(args)
    {
        var f = new File(args.getString(0));
        f.remove();
    }
}
/* #else
function PersistantCache(name)
{
    this.storage = new StorageWrapper("cache");

    var keysToDel = [];
    for (var key in this.storage)
        if (key.indexOf("expiration:") == 0)
            if (this.storage.get(key) < Date.now())
                keysToDel.push(key.substr("expiration:".length));

    for (var i = 0; i < keysToDel.length; i++)
        this.removeValue(keysToDel[i]);
}

_DECL_(PersistantCache).prototype =
{
    setValue: function(key, value, expirationDate, storeAsFile)
    {
        this.storage.set("value:"+key, value);
        if (expirationDate)
            this.storage.set("expiration:"+key, expirationDate.getTime());
        return value;
    },

    getValue: function(key, asFile)
    {
        var data = this.storage.get("value:"+key);
        if (data != null && asFile)
            return "data:image/png;base64,"+btoa(data);
        return data;
    },

    removeValue: function(key)
    {
        this.storage.delete("value:"+key);
        this.storage.delete("expiration:"+key);
    },

    bumpExpirationDate: function(key, expirationDate)
    {
        if (this.getValue(key) != null)
            this.storage.set("expiration:"+key, expirationDate.getTime());
    },

    clear: function()
    {
        var keys = [i for (i in this.storage)]
        for (var i = 0; i < keys.length; i++)
            this.storage.delete(keys[i]);
    },

    iterator: function(prefix, asFile)
    {
        return {
            prefix: "value:"+prefix,
            storage: this.storage,
            asFile: asFile,

            __iterator__: function(onlyKeys) {
                if (onlyKeys) {
                    for (var key in this.storage)
                        if (key.indexOf(this.prefix) == 0)
                            yield (key.slice(6));
                } else
                    for (var [key, val] in this.storage)
                        if (key.indexOf(this.prefix) == 0)
                            yield ([key.slice(6), this.asFile ?
                                "data:image/png;base64,"+btoa(val) : val]);
            }
        };
    }
}
// #endif */
