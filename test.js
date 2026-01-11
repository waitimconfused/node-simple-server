function test() {
	let beforeTime = performance.now();

	import("./lib/websocket.js");

	let afterTime = performance.now();

	return afterTime - beforeTime;
}

let count = 100;
let total = 0;
for (let i = 0; i < 100; i ++) {
	let time = test();
	console.log("Test #"+(i+1), time);
	total += time;
}

console.log("Average:", total/count);