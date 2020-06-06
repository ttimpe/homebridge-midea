class Utils {
	getSign(path, form) {
        const postfix = "/" + path.split("/").slice(3).join("/");
        const ordered = {};
        Object.keys(form)
            .sort()
            .forEach(function (key) {
                ordered[key] = form[key];
            });
        const query = Object.keys(ordered)
            .map((key) => key + "=" + ordered[key])
            .join("&");

        return crypto
            .createHash("sha256")
            .update(postfix + query + this.appKey)
            .digest("hex");
    }	
}