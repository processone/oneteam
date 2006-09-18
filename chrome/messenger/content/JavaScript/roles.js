/**
 *
 * @tparam    obj
 * @tparam    parent
 *
 * @treturn 
 */
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
{try{
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
        checkReqs(obj, requires[i].name, requires[i].reqs, obj.prototype);
    }catch(ex){dump(ex)}
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
            if (g = newProto.__lookupGetter__(i))
                oldProto.__defineGetter__(i, g);
            if (s = newProto.__lookupSetter__(i))
                oldProto.__defineSetter__(i, s);
            if (!g && !s)
                oldProto[i] = newProto[i];
        }
    oldProto.__proto__ = newProto.__proto__;

    return oldProto;
}

function checkReqs(obj, roleName, reqs, proto, result)
{
    var nmReqs = [];
    for (var i = 0; i < reqs.length; i++) {
        if (reqs[i] instanceof Array) {
            if (!reqs[i].some(function(n){return n in proto}))
                if (result)
                    nmReqs.push(reqs[i]);
                else
                    throw new Error("Role "+roleName+" composed into "+obj.name+
                                    " requires  any of ("+reqs[i].join(", ")+
                                    " ) properties.");
        } else if (!(reqs[i] in proto))
            if (result)
                nmReqs.push(reqs[i]);
            else
                throw new Error("Role "+roleName+" composed into "+obj.name+" requires ("+
                    reqs[i]+") property.");
    }
    if (nmReqs.length)
        result.push({name: roleName, reqs: nmReqs});
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
        if (g = proto.__lookupGetter__(i))
            objProto.__defineGetter__(j, g);
        if (s = proto.__lookupSetter__(i))
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

var WALK = {}
WALK.asceding = {
    __noSuchMethod__: function(name, args)
    {
        var chain = getInheritanceChain(args[0], name);
    }
}
