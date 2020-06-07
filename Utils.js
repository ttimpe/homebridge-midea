class Utils {
 encode(data) {
     	const normalized = [];
     	for (let b of data) {
     		b = parseInt(b);
     		if (b >= 128) {
     			b = b - 256;
     		}
     		normalized.push(b);
     	}
     	return normalized;
     }
   
     
    decode(data) {
     	const normalized = [];
     	for (let b of data) {
     		b = parseInt(b);
     		if (b < 0) {
     			b = b + 256;
     		}
     		normalized.push(b);
     	}
     	return normalized;
     }
       getStamp() {
     	const date = new Date();
     	return date.toISOString().slice(0, 19).replace(/-/g, "").replace(/:/g, "").replace(/T/g, "");
     }

}