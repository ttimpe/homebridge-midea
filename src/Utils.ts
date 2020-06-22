export default class Utils {
 static encode(data: number[]) : number[] {
          const normalized = [];
          for (let b of data) {
               if (b >= 128) {
                    b = b - 256;
               }
               normalized.push(b);
          }
          return normalized;
     }
   
     
    static decode(data: number[]) : number[] {
          const normalized = [];
          for (let b of data) {
               
               if (b < 0) {
                    b = b + 256;
               }
               normalized.push(b);
          }
          return normalized;
     }
     static getStamp() : string {
          const date = new Date();
          return date.toISOString().slice(0, 19).replace(/-/g, "").replace(/:/g, "").replace(/T/g, "");
     }

}