var EXPORTED_SYMBOLS = ["_DECL_", "_DECL_NOW_", "does", "lookupForParentMethod",
                        "META", "WALK"];

//ML.importMod("exceptions.js");

function _DECL_(obj, parent)
{
    obj.watch("prototype", setProtoAndMix);
    obj.__DECL_ARGS__ = arguments;

    return obj;
}

/**
 * Mixin roles into object prototype.
 *
 * This function takes is multiargument, after object contructor argument you
 * need to give roles which you want to mixin into \c obj.
 *
 * @tparam  Function  obj Object construtor which you want to change
 *
 * @public
 */
function _DECL_NOW_(obj)
{
    if (arguments[1])
        obj.prototype.__proto__ = arguments[1].prototype;

    obj.prototype.__META__ = {};

    if (arguments.length <= 2)
        return;

    var i, objProto = obj.prototype;
    var mixedProps = {}, requires = [];

    objProto.__META__.roles = []
    objProto.__META__.allRoles = []

    for (i = 2; i < arguments.length; i++) {
        if (typeof(arguments[i]) == "function")
            mixProto(arguments[i], {}, {}, objProto, mixedProps, requires, 0);
        else
            mixProto(arguments[i].role, arguments[i].exclude || {},
                     arguments[i].alias || {}, objProto, mixedProps,
                     requires, 0);
    }
    for (i = 0; i < requires.length; i++)
        checkReqs(obj, requires[i].name, requires[i].reqs, obj.prototype, null, mixedProps);
}

/**
 *
 *
 * @tparam    obj
 * @tparam    role
 *
 * @treturn
 *
 * @public
 */
function does(obj, role)
{
    if (obj instanceof role)
        return true;

    return obj.__META__.allRoles.indexOf(role) != -1;
}

function setProtoAndMix(obj, oldProto, newProto)
{
    var args = this.__DECL_ARGS__;
    delete this.__DECL_ARGS__;

    var ret = setPrototype.call(this, obj, oldProto, newProto);
    _DECL_NOW_.apply(this, args);

    return ret;
}

function setPrototype(obj, oldProto, newProto)
{
    var i, g, s;

    this.unwatch("prototype");

    if (!newProto)
        return oldProto;

    for (i in newProto)
        if (newProto.hasOwnProperty(i)) {
            if ((g = newProto.__lookupGetter__(i)))
                oldProto.__defineGetter__(i, g);
            if ((s = newProto.__lookupSetter__(i)))
                oldProto.__defineSetter__(i, s);
            if (!g && !s)
                oldProto[i] = newProto[i];
        }
    oldProto.__proto__ = newProto.__proto__;

    return oldProto;
}

function checkReqs(obj, roleName, reqs, proto, result, mixedProps)
{try{
    var nmReqs = [];
    for (var i = 0; i < reqs.length; i++) {
        if (reqs[i] instanceof Array) {
            if (!reqs[i].some(function(n){return n in proto}) || mixedProps &&
                reqs[i].every(function(n){return mixedProps[n].role.name == roleName}))
            {
                if (result)
                    nmReqs.push(reqs[i]);
                else
                    throw new Error("Role "+roleName+" composed into "+obj.name+
                                    " requires at least one of ("+reqs[i].join(", ")+
                                    ") properties.");
            }
        } else if (!(reqs[i] in proto) ||
                   mixedProps && mixedProps[reqs[i]].role.name == roleName)
            if (result)
                nmReqs.push(reqs[i]);
            else
                throw new Error("Role "+roleName+" composed into "+obj.name+" requires ("+
                    reqs[i]+") property.");
    }
    if (nmReqs.length)
        result.push({name: roleName, reqs: nmReqs});
}catch(ex){dump(exceptionToString(ex)+"\n")}
}

function mixProto(cons, exclusions, aliases, objProto, mixedProps,
                  requires, depth)
{
    var proto, name;
    var i, j;
    var g, s;

    if (does(objProto, cons))
        return;

    if (!depth)
        objProto.__META__.roles.push(cons);
    objProto.__META__.allRoles.push(cons);

    proto = cons.prototype;
    name = cons.name;

    for (i in proto) {
        j = aliases[i] == null ? i : aliases[i];
        if (i in exclusions || !proto.hasOwnProperty(i))
            continue;

        g = proto.__lookupGetter__(i);
        s = proto.__lookupSetter__(i);

        if (g || s) {
            if ((!g || g === objProto.__lookupGetter__(j)) &&
                (!s || s === objProto.__lookupSetter__(j)))
                continue;
        } else if (proto[i] === objProto[j])
            continue;

        if (i in mixedProps) {
            if (!(cons.prototype instanceof mixedProps[i].role))
                throw new Error("Conflict for property ("+j+") during compositing "+
                                mixedProps[j].name+" and "+name+" into "+
                                objProto.constructor.name);
            if (mixedProps[i].depth <= depth)
                continue;
        } else if (i in objProto)
            continue;

        if (i == "ROLE_REQUIRES") {
            checkReqs(null, name, proto.ROLE_REQUIRES, objProto, requires);
            continue;
        }
        if (g)
            objProto.__defineGetter__(j, g);
        if (s)
            objProto.__defineSetter__(j, s);
        if (!g && !s)
            objProto[j] = proto[i];
        mixedProps[j] = {depth: depth, role: cons};
        exclusions[j] = 1;
    }

    proto = proto.__proto__;
    if (proto && proto != Object.prototype)
        mixProto(proto.constructor, exclusions, aliases, objProto,
                 mixedProps, requires, depth+1);
}

function getInheritanceChain(obj, name)
{
    if (!obj.__proto__.__META__.inheritanceChain)
        obj.__proto__.__META__.inheritanceChain = {};
    if (obj.__proto__.__META__.inheritanceChain[name])
        return obj.__proto__.__META__.inheritanceChain[name];

    if (!obj.__proto__.__META__.inheritanceChain['']) {
        var c = [], p = obj.__proto__;
        while (p && "__META__" in p) {
            c.push(p.constructor);
            for (var i = 0; i < p.__META__.roles.length; i++) {
                var role = p.__META__.roles[i];
                while (role && c.indexOf(role) >= 0) {
                    c.push(role);
                    role = role.prototype.__proto__.constructor;
                }
            }
            p = p.__proto__;
        }
        obj.__proto__.__META__.inheritanceChain[''] = c;
    }

    return obj.__proto__.__META__.inheritanceChain[name] =
        obj.__proto__.__META__.inheritanceChain[''].filter(
          function(o){return name in o.__proto__});
}

function lookupForParentMethod(obj, fun)
{
    for (var name in obj)
        if (obj[name] == fun)
            break;

    var parentMethod;
    if (obj.__proto__.__proto__ && obj.__proto__.__proto__[name])
        parentMethod = "this.__proto__.__proto__";
    else if (obj.__proto__.__META__ && obj.__proto__.__META__.roles) {
        var roles = obj.__proto__.__META__.roles;
        for (var i = 0; i < roles.length; i++)
            if (roles[i].prototype[name])
                parentMethod = "this.__proto__.__META__.roles["+i+"].prototype";
    }
    return [name, parentMethod ? parentMethod+"["+uneval(name)+"]" : null];
}

var META = {
    after: function(after) {
        var fun = function() {
            var [name, parent] = lookupForParentMethod(this, arguments.callee);

            if (!parent && this.__proto__[name])
                parent = "this.__proto__["+uneval(name)+"]";

            this[name] = parent ?
                new Function("", "var ret="+parent+".apply(this, arguments);"+
                             "arguments.callee.after.apply(this, arguments);return ret") :
                arguments.callee.after;
            this[name].after = arguments.callee.after;
            this[name].apply(this, arguments);
        };

        fun.after = after;
        return fun;

    },

    before: function(before) {
        var fun = function() {
            var [name, parent] = lookupForParentMethod(this, arguments.callee);

            if (!parent && this.__proto__[name])
                parent = "this.__proto__["+uneval(name)+"]";

            this[name] = parent ?
                new Function("", "arguments.callee.before.apply(this, arguments);"+
                             "return "+parent+".apply(this, arguments)") :
                arguments.callee.before;
            this[name].before = arguments.callee.before;
            this[name].apply(this, arguments);
        };

        fun.before = before;
        return fun;
    },

    next: function(obj)
    {
        if (!arguments.callee.caller.next)
            [,arguments.callee.caller.next] =
                lookupForParentMethod(obj, arguments.callee.caller);
        return arguments.callee.caller.next(obj, Array.slice(arguments, 1));
    },

    ACCESSORS: {
        replace: function(_this, name, newValue) {
            delete _this[name];
            var proto = _this.__proto__;
            _this.__proto__ = {};
            _this[name] = newValue;
            _this.__proto__ = proto;
            return newValue;
        }
    }
}

var WALK = {}
WALK.asceding = {
    __noSuchMethod__: function(name, args)
    {
        var realArgs = Array.slice(args, 1);
        var chain = getInheritanceChain(args[0], name);
        for (var i = 0; i < chain.length; i++)
            args[0][name].apply(args[0], realArgs);
    }
}

WALK.desceding = {
    __noSuchMethod__: function(name, args)
    {
        var realArgs = Array.slice(args, 1);
        var chain = getInheritanceChain(args[0], name);
        for (var i = chain.length-1; i >= 0; i--)
            args[0][name].apply(args[0], realArgs);
    }
}
