var EXPORTED_SYMBOLS = ["generateXULFromDataForm", "buildResponseDataFormFromXUL"];

function generateXULFromDataForm(data, doc)
{
    const XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    const ns = new Namespace("jabber:x:data");

    var container = doc.createElementNS(XULNS, "vbox");
    container.setAttribute("flex", "1");
    container.setAttribute("class", "data-form-container");

    if (data.ns::title[0]) {
        var el = doc.createElementNS(XULNS, "label");
        el.setAttribute("class", "data-form-title");
        el.setAttribute("value", data.ns::title[0].text());
        container.appendChild(el);
    }

    for each (var instruction in data.ns::instructions) {
        el = doc.createElementNS(XULNS, "description");
        el.setAttribute("class", "data-form-description");
        el.appendChild(doc.createTextNode(instruction.text()));
        container.appendChild(el);
    }

    var grid = doc.createElementNS(XULNS, "grid");
    container.appendChild(grid);

    var cols = doc.createElementNS(XULNS, "columns");
    cols.appendChild(doc.createElementNS(XULNS, "column"));
    cols.appendChild(doc.createElementNS(XULNS, "column")).
        setAttribute("flex", "1");
    grid.appendChild(cols);

    var rows = doc.createElementNS(XULNS, "rows");
    grid.appendChild(rows);
    var row;

    for each (field in data.ns::field) {
        switch (field.@type.toString()) {
            case "boolean":
                row = doc.createElementNS(XULNS, "row");
                row.appendChild(doc.createElementNS(XULNS, "box"));

                el = doc.createElementNS(XULNS, "checkbox");
                el.setAttribute("class", "data-form-field-boolean");
                el.setAttribute("label", field.@label.toString());
                if (field.ns::value[0])
                    el.setAttribute("checked", +field.ns::value[0].text().toString() == 1);
                el._var = field.@var.toString();
                el._type = "boolean";
                el._value = "checked";
                el._transform = "toBool";
                el._required = field.ns::required.length() > 0;
                row.appendChild(el)
                rows.appendChild(row);
                break;
            case "fixed":
                for each (var value in field.ns::value) {
                    el = doc.createElementNS(XULNS, "label");
                    el.setAttribute("class", "data-form-field-fixed");
                    el.setAttribute("value", value.text().toString());
                    el._var = field.@var.toString();
                    el._type = "fixed";
                    el._value = "value";
                    rows.appendChild(el);
                }
                break;
            case "hidden":
                el = doc.createElementNS(XULNS, "label");
                el.setAttribute("class", "data-form-field-hidden");
                el.setAttribute("value", [v.text().toString() for each (v in field.ns::value)].join("\n"));
                el.setAttribute("hidden", "true");
                el._var = field.@var.toString();
                el._type = "hidden";
                el._value = "value";
                el._transform = "split";
                el._required = field.ns::required.length() > 0;
                rows.appendChild(el);
                break;
            case "jid-multi":
                row = doc.createElementNS(XULNS, "row");
                el = doc.createElementNS(XULNS, "label");
                el.setAttribute("class", "data-form-field-label");
                el.setAttribute("value", field.@label);
                row.appendChild(el);

                el = doc.createElementNS(XULNS, "listeditor");
                el.setAttribute("class", "data-form-field-jid-multi");
                el.setAttribute("regex", "[^@]+@(?:\\w(?:[\\w-]*\\w)?\\.)*[^\\W\\d](?:[\\w-]*\\w)?$");
                el.setAttribute("errortext", "This is not valid jid value");
                el.setAttribute("type", "verifiable");
                el.values = [v.text().toString() for each (v in field.ns::value)];
                el._var = field.@var.toString();
                el._type = "jid-multi";
                el._value = "values";
                el._transform = "flatten";
                el._required = field.ns::required.length() > 0;
                row.appendChild(el);
                rows.appendChild(row);
                break;
            case "jid-single":
                row = doc.createElementNS(XULNS, "row");
                el = doc.createElementNS(XULNS, "label");
                el.setAttribute("class", "data-form-field-label");
                el.setAttribute("value", field.@label);
                row.appendChild(el);

                el = doc.createElementNS(XULNS, "textbox");
                el.setAttribute("class", "data-form-field-jid-single");
                el.setAttribute("regex", "[^@]+@(?:\\w(?:[\\w-]*\\w)?\\.)*[^\\W\\d](?:[\\w-]*\\w)?$");
                el.setAttribute("errortext", "This is not valid jid value");
                el.setAttribute("type", "verifiable");
                if (field.ns::value[0])
                    el.setAttribute("value", field.ns::value[0].text().toString());
                el._var = field.@var.toString();
                el._type = "jid-single";
                el._value = "value";
                el._required = field.ns::required.length() > 0;
                row.appendChild(el);
                rows.appendChild(row);
                break;
            case "list-multi":
                row = doc.createElementNS(XULNS, "row");
                el = doc.createElementNS(XULNS, "label");
                el.setAttribute("class", "data-form-field-label");
                el.setAttribute("value", field.@label);
                row.appendChild(el);

                el = doc.createElementNS(XULNS, "listbox");
                el.setAttribute("class", "data-form-field-list-multi");
                el.setAttribute("seltype", "multiple");
                for each (var option in field.ns::option) {
                    var li = doc.createElementNS(XULNS, "listitem");
                    li.setAttribute("label", option.@label);
                    li.setAttribute("value", option.ns::value.text());
                    if (field.ns::value.(function::text() == option.ns::value.text()).length())
                        li.setAttribute("selected", "true");
                    el.appendChild(li);
                }
                el._var = field.@var.toString();
                el._type = "list-multi";
                el._value = "selectedItems";
                el._transform = "flattenValues";
                el._required = field.ns::required.length() > 0;
                row.appendChild(el);
                rows.appendChild(row);
                break;
            case "list-single":
                row = doc.createElementNS(XULNS, "row");
                el = doc.createElementNS(XULNS, "label");
                el.setAttribute("class", "data-form-field-label");
                el.setAttribute("value", field.@label);
                row.appendChild(el);

                el = doc.createElementNS(XULNS, "radiogroup");
                el.setAttribute("class", "data-form-field-list-single");
                el.setAttribute("seltype", "multiple");
                if (field.ns::value[0])
                    el.setAttribute("value", field.ns::value[0]);
                for each (var option in field.ns::option) {
                    var li = doc.createElementNS(XULNS, "radio");
                    li.setAttribute("label", option.@label);
                    li.setAttribute("value", option.ns::value.text());
                    if (field.ns::value.(function::text() == option.ns::value.text()).length())
                        li.setAttribute("selected", "true");
                    el.appendChild(li);
                }
                el._var = field.@var.toString();
                el._type = "list-single";
                el._value = "value";
                el._required = field.ns::required.length() > 0;
                row.appendChild(el);
                rows.appendChild(row);
                break;
            case "text-multi":
                row = doc.createElementNS(XULNS, "row");
                el = doc.createElementNS(XULNS, "label");
                el.setAttribute("class", "data-form-field-label");
                el.setAttribute("value", field.@label);
                row.appendChild(el);

                el = doc.createElementNS(XULNS, "textbox");
                el.setAttribute("class", "data-form-field-text-multi");
                el.setAttribute("multiline", "true");
                el.setAttribute("value", [v.text().toString() for each (v in field.ns::value)].join("\n"));
                el._var = field.@var.toString();
                el._type = "text-multi";
                el._value = "value";
                el._transform = "split";
                el._required = field.ns::required.length() > 0;
                row.appendChild(el);
                rows.appendChild(row);
                break;
            case "text-private":
                row = doc.createElementNS(XULNS, "row");
                el = doc.createElementNS(XULNS, "label");
                el.setAttribute("class", "data-form-field-label");
                el.setAttribute("value", field.@label);
                row.appendChild(el);

                el = doc.createElementNS(XULNS, "textbox");
                el.setAttribute("class", "data-form-field-text-private");
                el.setAttribute("type", "password");
                if (field.ns::value[0])
                    el.setAttribute("value", field.ns::value[0].text().toString());
                el._var = field.@var.toString();
                el._type = "text-private";
                el._value = "value";
                el._required = field.ns::required.length() > 0;
                row.appendChild(el);
                rows.appendChild(row);
                break;
            case "text-single":
                row = doc.createElementNS(XULNS, "row");
                el = doc.createElementNS(XULNS, "label");
                el.setAttribute("class", "data-form-field-label");
                el.setAttribute("value", field.@label);
                row.appendChild(el);

                el = doc.createElementNS(XULNS, "textbox");
                el.setAttribute("class", "data-form-field-text-private");
                if (field.ns::value[0])
                    el.setAttribute("value", field.ns::value[0].text().toString());
                el._var = field.@var.toString();
                el._type = "text-single";
                el._value = "value";
                el._required = field.ns::required.length() > 0;
                row.appendChild(el);
                rows.appendChild(row);
                break;
        }
        if (field.ns::desc[0]) {
            el = doc.createElementNS(XULNS, "description");
            el.setAttribute("class", "data-form-field-description");
            el.appendChild(doc.createTextNode(field.ns::desc[0].text()));
            rows.appendChild(el);
        }
    }
    return container;
}

function buildResponseDataFormFromXUL(element)
{
    var res = <x xmlns="jabber:x:data" type="submit"/>
    var ns = res.namespace();
    default xml namespace = ns;

    var els = element.getElementsByTagName("*");
    for (var i = 0; i < els.length; i++) {
        if (els[i]._var) {
            var idx = res.ns::field.(@var == els[i]._var)[0] &&
                res.ns::field.(@var == els[i]._var).childIndex();
            var field = idx != null ? res.ns::field[idx] :
                <field var={els[i]._var} type={els[i]._type}/>;

            var value = els[i][els[i]._value];

            if (els[i]._transform == "split")
                for each (var line in value.split("\n"))
                    field.* += <value>{line}</value>;
            else if (els[i]._transform == "toBool")
                field.* += <value>{value ? 1 : 0}</value>;
            else if (els[i]._transform == "flatten")
                for each (var item in value)
                    field.* += <value>{item}</value>;
            else if (els[i]._transform == "flattenValues")
                for each (var item in value)
                    field.* += <value>{item.value}</value>;
            else
                field.* += <value>{value}</value>;

            if (idx == null)
                res.* += field;
            else
                res.ns::field[idx] = field;
        }
    }
    return res;
}
