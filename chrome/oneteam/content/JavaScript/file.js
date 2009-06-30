var EXPORTED_SYMBOLS = ["CharsetConverter", "detectXMLCharset",
                        "convertCharsetOfXMLData", "CharsetConvertError",
                        "Reader", "IOError", "File", "slurpFile",
                        "makeDataUrlFromFile"];

ML.importMod("roles.js");
ML.importMod("exceptions.js");

/**
 * Converts strings between unicode and other encoding schemes.
 *
 * @ctor
 *
 * Create new CharsetConverter object.
 *
 * @tparam String charset String with name of external encoding.
 */
function CharsetConverter(charset)
{
    this.charset = charset;
    try {
        this.__converter = Components.classes[
            "@mozilla.org/intl/scriptableunicodeconverter"].
        getService(Components.interfaces.
            nsIScriptableUnicodeConverter);
    } catch (ex) {
        throw new CharsetConvertError(
            "CharsetConverter: unable to instantiate interface", ex);
    }
}

_DECL_(CharsetConverter).prototype =
{
    /**
     * Name of external encoding.
     *
     * @type String
     * @public
     */
    charset: null,

    /**
     * Convert string from unicode to external encoding scheme.
     *
     * @tparam String data String to encode.
     *
     * @treturn String Encoded string.
     *
     * @public
     */
    encode: function(data)
    {
        if (this.charset) {
            try {
                this.__converter.charset = this.charset;
                return this.__converter.ConvertFromUnicode(data);
            } catch (ex) {
                throw new CharsetConvertError(
                    "CharsetConverter.encode: conversion error", ex);
            }
        }
        return data;
    },

    /**
     * Convert string from external encoding scheme to unicode.
     *
     * @tparam String data String to convert.
     *
     * @treturn String Converted string.
     *
     * @public
     */
    decode: function(data)
    {
        if (this.charset) {
            try {
                this.__converter.charset = this.charset;
                return this.__converter.ConvertToUnicode(data);
            } catch (ex) {
                throw new CharsetConvertError(
                    "CharsetConverter.decode: conversion error", ex);
            }
        }
        return data;
    }
}

/**
 * This is local variable
 * @static
 */
var magic = [
    [/^\xEF\xBB\xBF/,     "UTF-8",    3],
    [/^\x3C\x3F\x78\x6D/, null,       0],
    [/^\x00\x00\xFE\xFF/, "UTF-32BE", 4],
    [/^\x00\x00\x00\x3C/, "UTF-32BE", 0],
    [/^\xFE\xFF\x00\x00/, "UTF-32LE", 4],
    [/^\x3C\x00\x00\x00/, "UTF-32LE", 0],
    [/^\xFE\xFF/,         "UTF-16BE", 2],
    [/^\x00\x3C\x00\x3F/, "UTF-16BE", 0],
    [/^\xFF\xFE/,         "UTF-16LE", 2],
    [/^\x3C\x00\x3F\x00/, "UTF-16LE", 0],
    [/./,                 "UTF-8",    0]
];

/**
 * Attempt to determine charset from xml prolog.
 *
 * @tparam String data String which contains xml prolog.
 * @tparam bool skipOctets Object in which xml prolog length will
 *   be stores as property \em value. <em>(optionam)</em>
 *
 * @treturn String String with name of encoding, or \c null if data is
 *   not sufficient to determine encoding.
 */
function detectXMLCharset(data, skipOctets)
{
    var i, converter, charset, res;

    for (i = 0; i < magic.length; i++)
        if (!data.search(magic[i][0]))
            if (magic[i][1]) {
                if (typeof(skipOctets) == "object")
                    skipOctets.value = magic[i][2];
                return magic[i][1];
            } else
                break;

    res = data.match(/^<\?xml\s+[^>]*encoding\s*=\s*(?:\"([^>\"]*)\"|\'([^>\']*)\')/);

    if ((idx = data.indexOf(">")) >= 0 || res) {
        if (typeof(skipOctets) == "object")
            skipOctets.value = magic[i][2];
        return res&&(!~idx||idx > res.index) ? res[1]||res[2]||"UTF-8" : "UTF-8";
    }
    return null;
}

/**
 * Converts xml data. Attempt to determine charset from xml prolog.
 *
 * @tparam String data String to convert.
 *
 * @treturn String Data from \c data converted to unicode.
 */
function convertCharsetOfXMLData(data)
{
    var skipOctets = {};
    var charset = detectXMLCharset(data, skipOctets);

    if (!charset)
        throw new CharsetConvertError(
            "convertCharsetOfXMLData: unable to determine charset");

    try {
        converter = Components.classes[
            "@mozilla.org/intl/scriptableunicodeconverter"].
            getService(Components.interfaces.nsIScriptableUnicodeConverter);
    } catch (ex) {
        throw new CharsetConvertError(
            "convertCharsetOfXMLData: unable to instantiate interface", ex);
    }

    converter.charset = charset;
    if (skipOctets.value == 0)
        return converter.ConvertToUnicode(data);
    else
        return converter.ConvertToUnicode(data.substring(skipOctets.value));
}

/**
 * Thrown when errors occurs during charset conversion of string.
 *
 * @ctor
 *
 * Create new CharsetConvertError
 *
 * @tparam String desc Message associated with exception. \e (optional)
 * @tparam Error reason Exception which causes this exception.
 * \e (optional)
 */
function CharsetConvertError(desc, reason)
{
    return GenericError.call(this, message||"CharsetConvertError", reason);
}

_DECL_NOW_(CharsetConvertError, GenericError);

/**
 * Class created to read data from stream speficied by uri.
 *
 * @ctor
 *
 * Creates new Reader object.
 *
 * @tparam  String  uriString String with uri which specifies input
 *   streams.
 *
 * @throws IOError Throws when \e uriString don't containt valid data.
 */
function Reader(uriString)
{
    const classes = Components.classes;
    const interfaces = Components.interfaces;

    var ios, tmp, i;

    try {
        ios = classes["@mozilla.org/network/io-service;1"].
            getService(interfaces.nsIIOService);
    } catch (ex) {
        throw new IOError("Reader: unable to instantiate interface", ex);
    }

    if (uriString) {
        if (uriString instanceof interfaces.nsIInputStream) {
            try {
                var bs = classes["@mozilla.org/binaryinputstream;1"].
                    createInstance(interfaces.nsIBinaryInputStream);

                bs.setInputStream(uriString);

                this.__inputStream = classes["@mozilla.org/scriptableinputstream;1"].
                    createInstance(interfaces.nsIScriptableInputStream);

                this.__inputStream.init(bs);
            } catch (ex) {
        	    throw new IOError("Reader: Initialization error", ex);
            }

            return;
        }
        if (typeof(uriString) == 'object') {
            tmp = uriString[0];
            for (i = 1; i < uriString.length; i++) {
                tmp += "/"+uriString[i];
            }
            uriString = tmp;
        }
	if (uriString[0] == "/")
	    uriString = "file://"+uriString;
        try {
            this.uri = ios.newURI(uriString, null, null);
        } catch (ex) {
    	    throw new IOError("Reader: invalid uri", ex);
        }
    }
}

_DECL_(Reader).prototype =
{
    __inputStream: null,
    __encoder: null,

    /**
     * Length of maximal available data segment. For file streams this
     * property contains length of file. <em>(read-only)</em>
     *
     * @type int
     * @public
     */
    get available ()
    {
        if (this.__inputStream)
            return this.__inputStream.available();
        return 0;
    },

    /**
     * Open streams.
     *
     * @tparam  String  charset String with charset id of data in
     *   stream. If specified, all readed data will be converted
     *   from format described by this parameter, to internal unicode format.
     *
     * @throws IOError Thrown when any IO error occurs.
     *
     * @public
     */
    open: function(charset)
    {
        const classes = Components.classes;
        const interfaces = Components.interfaces;

        if (this.__inputStream)
            return;

        var ios = classes["@mozilla.org/network/io-service;1"].
            getService(interfaces.nsIIOService);
        this.setCharset(charset);

        var channel = ios.newChannelFromURI(this.uri);
        if (!channel)
            throw new IOError("Reader.open: unable to create channel");

        try {
            var is = channel.open();

            this.__binaryInputStream = classes["@mozilla.org/binaryinputstream;1"].
                createInstance(interfaces.nsIBinaryInputStream);

            this.__binaryInputStream.setInputStream(is);

            this.__inputStream = classes["@mozilla.org/scriptableinputstream;1"].
                createInstance(interfaces.nsIScriptableInputStream);

            this.__inputStream.init(is);
        } catch (ex) {
            throw new IOError("Reader.open: unable to create stream", ex);
        }
    },

    /**
     * Set charset used to convert data from stream.
     *
     * @tparam  String  charset Name of charset used by converter.
     *
     * @public
     */
    setCharset: function(charset)
    {
        if (charset) {
            if (this.__coder)
                this.__coder.charset = charset;
            else
                this.__coder = new CharsetConverter(charset);
        } else
            this.__coder = null;
    },

    /**
     * Reads data from stream.
     *
     * @tparam  int  length  Size of data to read. This value will be
     *   trimed to length of current available data segment. Default
     *   value for this parameter is value of #available property.
     *   <em>(optional)</em>
     *
     * @treturn  String  Data readed from stream.
     *
     * @throws IOError Thrown when any IO error occurs.
     * @throws CharsetConvertError Thrown when charset conversion fails.
     *
     * @public
     */
    read: function(length)
    {
        var result;

        try {
            var available = this.__inputStream.available();

            if (!length || length > available)
                length = available;

            result = this.__binaryInputStream.readBytes(length);
        } catch (ex) {
            throw new IOError("Reader.read: read error", ex);
        }

        if (this.__coder)
            return this.__coder.decode(result);
        return result;
    },

    /**
     * Close stream.
     *
     * @public
     */
    close: function()
    {
        if (this.__inputStream)
            this.__inputStream.close();
        this.__inputStream = null;
    }
}

/**
 * Thrown when errors occurs in any IO related object.
 *
 * @ctor
 *
 * Create new IOError exception.
 *
 * @tparam  String  message  Message associated with exception.
 *   <em>(optional)</em>
 * @tparam  Exception  reason  Exception which causes this exception.
 *   <em>(optional)</em>
 */
function IOError(message, reason, ommit)
{
    return GenericError.call(this, message||"IOError", reason);
}

_DECL_NOW_(IOError, GenericError);

/**
 * File access class.
 *
 * @ctor
 *
 * Create new File object.
 *
 * @tparam  String  path  File path. This can be also \c nsIURI object
 * with "file" scheme.
 *
 * @throws  IOError Thrown on IO errors.
 */
function File(path)
{
    const classes = Components.classes;
    const interfaces = Components.interfaces;

    try {
        if (path instanceof interfaces.nsIFile) {
            this.file = path.QueryInterface(interfaces.nsILocalFile);
        } else {
            this.file = classes["@mozilla.org/file/local;1"].
                createInstance(interfaces.nsILocalFile);

            if (path instanceof File)
                this.file.initWithPath(path.path);
            else if (path.search(/file:\/\//) == 0) {
                this.file.initWithPath(path.replace(/^file:\/\//, ""));
            } else if (path.search(/\w+:\/\//) == -1)
                this.file.initWithPath(path);
            else {
                Reader.call(this, arguments);

                this.file.initWithPath(this.uri.
                    QueryInterface(interfaces.nsIFileURL).file.path);
            }
        }
        if (!this.uri) {
            for (var i = 1; i < arguments.length; i++)
                this.file.append(arguments[i]);
            this.uri = classes["@mozilla.org/network/io-service;1"].
                getService(interfaces.nsIIOService).newFileURI(this.file);
        }
    } catch (ex) {
        throw new IOError("File: unable to create file object", ex);
    }

    this.path = this.file.path;
}

_DECL_(File, Reader).prototype =
{
    /**
     * Flag used by open() method.
     *
     * @type int
     * @public
     */
    MODE_RDONLY   : 0x01,
    /**
     * Flag used by open() method.
     *
     * @type int
     * @public
     */
    MODE_WRONLY   : 0x02,
    /**
     * Flag used by open() method.
     *
     * @type int
     * @public
     */
    MODE_RDWR     : 0x04,
    /**
     * Flag used by open() method.
     *
     * @type int
     * @public
     */
    MODE_CREATE   : 0x08,
    /**
     * Flag used by open() method.
     *
     * @type int
     * @public
     */
    MODE_APPEND   : 0x10,
    /**
     * Flag used by open() method.
     *
     * @type int
     * @public
     */
    MODE_TRUNCATE : 0x20,
    /**
     * Flag used by open() method.
     *
     * @type int
     * @public
     */
    MODE_SYNC     : 0x40,
    /**
     * Flag used by open() method.
     *
     * @type int
     * @public
     */
    MODE_EXCL     : 0x80,

    /**
     * This file uri.
     *
     * @type nsIURI.
     * @public
     */
    uri: null,

    /**
     * Implementation of \e nsILocalFile interface used to handle this
     *   file object.
     *
     * @type nsILocalFile
     * @public
     */
    file: null,

    /**
     * String with full path to our file.
     *
     * @type String
     * @public
     */
    path: null,

    /**
     * \c true if file (or directory) with this path exists.
     *
     * @type bool
     * @public
     */
    get exists ()
    {
        return this.file.exists();
    },

    /**
     * Size of file.
     *
     * @type int
     * @public
     */
    get size()
    {
        return this.file.fileSize;
    },

    /**
     * Open file.
     *
     * @tparam  String  charset  Name of charset in which file is coded.
     *     Reader.read() and write() methods performs conversion
     *     in-the-fly. <em>(optional)</em>
     * @tparam  int     mode     Open mode, bit mask of \e MODE_*
     *   attributes.
     * @tparam  int     perms    Unix like file permisions code. Used on
     *   file creation. By default 0644 value is used.
     *   <em>(optional)</em>.
     *
     * @throws  IOError  Thrown on any IO error.
     *
     * @public
     */
    open: function(charset, mode, perms)
    {
        const classes = Components.classes;
        const interfaces = Components.interfaces;

        this.setCharset(charset);

        if (typeof perms == "undefined")
            perms = 0644;

        this.__inputStream = this.__outputStream = null;

        if (mode & (this.MODE_WRONLY | this.MODE_RDWR))
        {
            try {
                this.__outputStream =
                    classes["@mozilla.org/network/file-output-stream;1"].
                    createInstance(interfaces.nsIFileOutputStream);
                this.__outputStream.init(this.file, mode, perms, false);
            } catch (ex) {
                this.__inputStream = this.__outputStream = null;

                throw new IOError("File.open: unable to create output stream",
                    ex);
            }
        }

        if (mode & (this.MODE_RDONLY | this.MODE_RDWR))
        {
            try {
                var is = classes["@mozilla.org/network/file-input-stream;1"].
                    createInstance(interfaces.nsIFileInputStream);

                this.__binaryInputStream = classes[
                    "@mozilla.org/binaryinputstream;1"].
                    createInstance(interfaces.nsIBinaryInputStream);

                is.init(this.file, mode, perms, false);
                this.__binaryInputStream.setInputStream(is);

                this.__inputStream = classes["@mozilla.org/scriptableinputstream;1"].
                    createInstance(interfaces.nsIScriptableInputStream);

                this.__inputStream.init(is);
            } catch (ex) {
                if (this.__outputStream)
                    this.__outputStream.close();
                this.__inputStream = this.__outputStream = null;

                throw new IOError("File.open: unable to create input stream",
                    ex);
            }
        }
    },

    /**
     * Write data to file.
     *
     * @tparam  String  data  Data to write.
     *
     * @throws  IOError  Thrown on any IO error.
     * @throws  CharsetConvertError Thrown when charset conversion fails.
     *
     * @public
     */
    write: function(data)
    {
        if (this.__coder)
            data = this.__coder.encode(data);
        try {
            return this.__outputStream.write(data, data.length);
        } catch (ex) {
            throw new IOError("File.write: unable to write date", ex);
        }
    },

    /**
     * Close file.
     *
     * @public
     */
    close: function()
    {
        if ("__outputStream" in this && this.__outputStream)
            this.__outputStream.close();
        if ("__inputStream" in this && this.__inputStream)
            this.__inputStream.close();
        this.__inputStream = this.__outputStream = null;
    },

    /**
     * Remove file or directory.
     *
     * @tparam  bool  recursive  If set to \c true this operation will
     *   delete not empty directories with all it contents.
     *
     * @throws  IOError  Thrown on any IO error.
     *
     * @public
     */
    remove: function(recursive)
    {
        if (!this.exists)
            return;

        try {
            this.close();
            this.file.remove(recursive);
        } catch (ex) {
            throw new IOError("File.remove: IO error", ex);
        }
    },

    /**
     * Flushes output buffer.
     *
     * @throws  IOError  Thrown on any IO error.
     *
     * @public
     */
    flush: function()
    {
        try {
            if (this.__outputStream)
                this.__outputStream.flush();
        } catch (ex) {
            throw new IOError("File.remove: IO error", ex);
        }
    },

    /**
     * Creates new directory.
     *
     * @tparam  int  perms  Unix permisions bits for new directory. By
     *   defaulr value of 0755 will be used. <em>(optional)</em>
     *
     * @throws  IOError  Thrown on any IO error.
     *
     * @public
     */
    createDirectory: function(perms)
    {
        try {
            this.file.create(1, perms == null ? 0755 : perms);
        } catch (ex) {
            throw new IOError("File.remove: Unable to create directory", ex);
        }
    }
}

function slurpFile()
{
    var file = new Reader(Array.slice(arguments, 0));

    file.open(null, 1);
    return file.read();
}

function makeDataUrlFromFile()
{
	var data = slurpFile.apply(null, arguments);
	return "data:image/png;base64,"+btoa(data)
}
