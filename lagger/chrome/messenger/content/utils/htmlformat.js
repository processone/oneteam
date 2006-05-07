function html_escape(message){
        message = message.replace(/\&/g, "&amp;").replace(/\</g, "&lt;")
                                  .replace(/\>/g, "&gt;");
        return message;
}

