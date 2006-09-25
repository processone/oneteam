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

    this.db.createFunction("deleteFile", 1, StorageFunctionDelete);
try{
    if (version == 0)
        this.db.executeSimpleSQL("BEGIN IMMEDIATE TRANSACTION;"+
            "CREATE TABLE cache (key TEXT PRIMARY KEY, value TEXT, "+
            "expiry_date INT(8), is_file INT(1)); "+

            "CREATE TRIGGER del_files_on_delete AFTER DELETE ON "+
            "cache FOR EACH ROW WHEN old.is_file = 1 "+
            "BEGIN SELECT deleteFile(old.value) WHERE NOT EXISTS ("+
            "SELECT 1 FROM cache WHERE value = old.value); END;"+

            "CREATE TRIGGER del_files_on_update AFTER UPDATE ON "+
            "cache FOR EACH ROW WHEN old.is_file = 1 "+
            "BEGIN SELECT deleteFile(old.value) WHERE NOT EXISTS ("+
            "SELECT 1 FROM cache WHERE value = old.value); END;"+

            "PRAGMA user_version = 1001; COMMIT TRANSACTION");
    else
        this.db.executeSimpleSQL("DELETE FROM cache WHERE expiry_date < "+Date.now());
}catch(ex){alert(this.db.lastErrorString); throw ex}
    this.getStmt = this.db.createStatement("SELECT value, is_file, expiry_date FROM cache "+
                                      "WHERE key = ?1");
    this.setStmt = this.db.createStatement("REPLACE INTO cache (key, value, is_file, "+
                                           "expiry_date) VALUES(?1, ?2, ?3, ?4)");
    this.bumpStmt = this.db.createStatement("UPDATE cache SET expiry_date = ?2 WHERE key = ?1");
}

_DECL_(PersistantCache).prototype =
{
    setValue: function(key, value, expiryDate, storeAsFile)
    {
        if (storeAsFile) {
            if (!this.fileCacheDir.exists)
                this.fileCacheDir.createDirectory();

            var charset = "0123456789abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";
            var file;

            do {
                var name = "";
                for (var i = 0; i < 10; ++i)
                    name += charSet.charAt(Math.floor(Math.random() * charSet.length));

                file = new File(this.fileCacheDir, name);
                try {
                    file.open(null, 0x02|0x08|0x80);
                } catch (ex) { file = null; }

            } while (!file);

            file.write(value);
            value = file.path;
        }
        this.setStmt.reset();
        this.setStmt.bindStringParameter(0, key);
        this.setStmt.bindStringParameter(1, value);
        this.setStmt.bindInt64Parameter(2, expiryDate.getTime());
        this.setStmt.bindInt32Parameter(3, storeAsFile ? 1 : 0);
        this.setStmt.execute();
        this.setStmt.reset();
    },

    getValue: function(key, asFile)
    {
        this.getStmt.reset();
        this.getStmt.bindStringParameter(0, key);
        if (!this.getStmt.executeStep())
            this.getStmt.reset();
            return null;
        if (this.getStmt.getInt64(2) < Date.now()) {
            this.getStmt.reset();
            this.db.executeSimpleSQL("DELETE FROM cache WHERE expiry_date < "+Date.now())
            return null;
        }

        var value = this.getStmt.getString(0);
        var type = this.getInt32(1);
        this.getStmt.reset();

        if (type) {
            if (!asFile)
                return slurpFile(value);
        } else if (asFile)
            throw new GenericError("Unable to return data as file path");

        return value;
    },

    bumpExpiryDate: function(key, expiryDate)
    {
        this.bumpStmt.reset();
        this.bumpStmt.bindStringParameter(0, key);
        this.bumpStmt.bindStringParameter(1, expiryDate.getTime());
        this.bumpStmt.execute();
        this.bumpStmt.reset();
    },
}

function StorageFunctionDelete()
{
}

_DECL_(StorageFunctionDelete).prototype =
{
    onFunctionCall: function(args)
    {
        f = new File(args.getString(0));
        f.remove();
    }
}

