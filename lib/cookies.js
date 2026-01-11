module.exports = {

	/**
	 * Extract cookies from a client request
	 * @param {import("..").ServerRequest} request 
	 * @returns {Object<string, string>}
	 */
	getAll(request) {
		let list = {};
		if (!request.headers?.cookie) return list;

		let cookieParts = request.headers.cookie.split(";");

		for (let cookie of cookieParts) {
			let parts = cookie.split(/\s*?(\S+?)\s*=\s*(.*?)\s*$/);
			let name = parts[1];
			let value = parts[2];
			if (!value) continue;
			list[name] = decodeURIComponent(value);
		}

		return list;
	},

	/**
	 * Set a cookie on a client result
	 * @param {string} key
	 * @param {string} value
	 * @param {import("..").ServerResult} result
	 */
	set(key, value, result) {
		let existingCookies = result.getHeader("Set-Cookie") ?? [];

		existingCookies.push(key+"="+value);
		result.setHeader("Set-Cookie", existingCookies); 	
	}

}