const fs = require("fs");

const fetchURL = "https://raw.githubusercontent.com/patrickmccallum/mimetype-io/master/src/mimeData.json";

const loading = "\x1b[33m↺\x1b[0m";
const completed = "\x1b[32m✓\x1b[0m";
const error = "\x1b[31m✓\x1b[0m";

console.log(loading, "Fetching JSON from:\n\t"+fetchURL);
fetch(fetchURL)
.then( res => res.json() )
.then( (mimeTypes) => {
	console.log(completed, "Fetching JSON complete.");
	console.log(loading, "Mapping");
	let object = {};
	for (let i = 0; i < mimeTypes.length; i ++) {
		let mime = mimeTypes[i];

		for (let x = 0; x < mime.fileTypes.length; x ++) {
			let extension = mime.fileTypes[x].replace(/^\./, "");
			object[extension] = mime.name;
		}
	}
	console.log(completed+" Mapping complete.");
	return object;
} )
.then( (cleanTypes) => {

	let path = __dirname.replaceAll("\\", "/") + "/json/mime_types.json";

	console.log(loading, "Writing to:\n\t"+path);
	fs.writeFile("./json/mime_types.json", JSON.stringify(cleanTypes, null, "\t"), () => {
		console.log(completed, "Writing to file complete.");
		// console.log(completed+" DONE!");
	});

} )
.catch((err) => {
	console.log(error, err);
})