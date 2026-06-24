import { calculateCost } from "./src/lib/billing";

const start = new Date("2026-06-23T10:00:00.000Z").getTime(); // 15:30 IST
const end1 = new Date("2026-06-23T10:14:00.000Z").getTime(); // 14 mins
const end2 = new Date("2026-06-23T10:15:00.000Z").getTime(); // 15 mins
const end3 = new Date("2026-06-23T10:16:00.000Z").getTime(); // 16 mins
const endCross = new Date("2026-06-23T11:00:00.000Z").getTime(); // 60 mins (2 slots before 4, 2 slots after 4)

console.log("14 mins pool:", calculateCost(start, end1, "pool"));
console.log("15 mins pool:", calculateCost(start, end2, "pool"));
console.log("16 mins pool:", calculateCost(start, end3, "pool"));
console.log("60 mins cross pool:", calculateCost(start, endCross, "pool"));
