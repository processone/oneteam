var EXPORTED_SYMBOLS = ["PersistentCache"];

ML.importMod("roles.js");
ML.importMod("file.js");

// #ifdef XULAPP
function PersistentCache(name)
{
    var file = Components.classes["@mozilla.org/file/directory_service;1"].
        getService(Components.interfaces.nsIProperties).
        get("ProfD", Components.interfaces.nsIFile);

    var fileCacheDir = file.clone();
    fileCacheDir.append(name+"Files");
    this.fileCacheDir = new File(fileCacheDir);

    if (!this.fileCacheDir.exists)
        this.fileCacheDir.createDirectory();

    // XXXpfx if path is not directory at creation url doesn't have / at end
    // which causes problem when nsResProtocol, tries later to resolve urls.
    this.fileCacheDir = new File(fileCacheDir);

    var ioService = Components.classes["@mozilla.org/network/io-service;1"].
        getService(Components.interfaces.nsIIOService);
    var resProt = ioService.getProtocolHandler("resource").
        QueryInterface(Components.interfaces.nsIResProtocolHandler);

    resProt.setSubstitution("oneteam-cache", this.fileCacheDir.uri);

    file.append(name+".sqlite");

    var storageService = Components.classes["@mozilla.org/storage/service;1"].
        getService(Components.interfaces.mozIStorageService);

    try {
        this.db = storageService.openDatabase(file);
    } catch (ex if ex.result == Components.results.NS_ERROR_FILE_CORRUPTED) {
        storageService.backupDatabaseFile(file, name+".sqlite.corrupted");

        try { this.db.close() } catch (ex2) {}

        file.remove(false);

        this.db = storageService.openDatabase(file);
    }

    this.db.executeSimpleSQL("PRAGMA synchronous = OFF");

    var version = this.db.schemaVersion;

    if (version > 1999)
        throw new GenericError("Unrecognized PersistentCache database version");

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

_DECL_(PersistentCache).prototype =
{
    setValue: function(key, value, expiryDate, storeAsFile)
    {
        if (storeAsFile) {
            var file;

            do {
                file = new File(this.fileCacheDir, generateRandomName("10"));
                try {
                    file.open(null, 0x02|0x08|0x80);
                } catch (ex) { file = null; }
            } while (!file);

            file.write(value);
            value = file.path;
            file.close();
        }
        this.setStmt.bindStringParameter(0, key);
        this.setStmt.bindStringParameter(1, typeof(value) == "object" ?
                                         "JSON:"+JSON.encode(value) : value);
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

            var fileObj = new File(value);

            if (!fileObj.exists) {
                this.removeValue(key);
                return null;
            }
            if (this.fileCacheDir.file.contains(fileObj.file, false))
                return "resource://oneteam-cache/"+fileObj.file.leafName;
            return "file://"+value;
        } else if (asFile)
            throw new GenericError("Unable to return data as file path");

        if (value.indexOf("JSON:") == 0)
            value = JSON.decode(value.substr(5));

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
function PersistentCache(name)
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

_DECL_(PersistentCache).prototype =
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
