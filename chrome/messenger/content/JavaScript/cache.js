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

    bumpExpiryDate: function(key, expiryDate)
    {
        this.bumpStmt.bindStringParameter(0, key);
        this.bumpStmt.bindInt64Parameter(1, expiryDate.getTime());
        this.bumpStmt.execute();
    },
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
    this.storage = window.top.storage ||
        globalStorage[document.location.host];

    this.data = {};
    for (var i = 0; i < this.storage.length; i++) {
        var key = this.storage.key(i), keyName;
        if ((keyName = key.replace(/^cache:/, "")) == key)
            continue;
        var expDate = this.storage["cacheExpiration:"+keyName];
        if (expDate < Date.now()) {
            delete this.storage["cacheExpiration:"+keyName];
            delete this.storage[key];
        } else
            this.data[keyName] = this.storage[key];
    }
}

_DECL_(PersistantCache).prototype =
{
    setValue: function(key, value, expiryDate, storeAsFile)
    {
        try{
            this.storage["cache:"+key] = value;
            if (expiryDate)
                this.storage["cacheExpiration:"+expiryDate.getTime()];
        } catch(ex) { report("developer", "error", ex) }

        this.data[key] = value;

        return value;
    },

    getValue: function(key, asFile)
    {
        var data = this.data[key];
        if (data != null && asFile)
            return "data:image/png;base64,"+btoa(data);
        return data;
    },

    removeValue: function(key)
    {
        try {
            delete this.storage["cache"+key];
            delete this.storage["cacheExpiration:"+key];
        } catch(ex) { report("developer", "error", ex) }
        delete this.data[key];
    },

    bumpExpiryDate: function(key, expiryDate)
    {
        try{
            if (this.data[key] != null)
                this.storage["cacheExpiration:"+key] = expiryDate.getTime();
        } catch(ex) { report("developer", "error", ex) }
    },
}
// #endif */
