// cooldown.js
class Cooldown {
   constructor(cooldownTime, maxRequestsPerCooldown) {
       this.cooldownTime = cooldownTime;
       this.maxRequestsPerCooldown = maxRequestsPerCooldown;
       this.lastRequestTime = Date.now();
       this.requestCount = 0;
   }

   checkCooldown() {
       const currentTime = Date.now();

       // Check if the cooldown period has expired
       if (currentTime - this.lastRequestTime > this.cooldownTime) {
           // Reset the cooldown
           this.lastRequestTime = currentTime;
           this.requestCount = 0;
       }

       // Increment the request count
       this.requestCount += 1;

       // Check if the request count exceeds the maximum allowed within the cooldown period
       if (this.requestCount > this.maxRequestsPerCooldown) {
           return false; // Cooldown in effect
       }

       return true; // Allowed to proceed
   }
}

export default Cooldown;