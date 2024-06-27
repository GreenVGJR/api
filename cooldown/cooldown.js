// utils/cooldown.js
class Cooldown {
    static cooldownTime = 10 * 1000; // 15 seconds
    static maxRequestsPerCooldown = 1;
    static lastRequestTime = Date.now();
    static requestCount = 1;

    static checkCooldown() {
        const currentTime = Date.now();

        // Check if the cooldown period has expired
        if (currentTime - Cooldown.lastRequestTime > Cooldown.cooldownTime) {
            // Reset the cooldown
            Cooldown.lastRequestTime = currentTime;
            Cooldown.requestCount = 0;
        }

        // Increment the request count
        Cooldown.requestCount += 1;

        // Check if the request count exceeds the maximum allowed within the cooldown period
        if (Cooldown.requestCount > Cooldown.maxRequestsPerCooldown) {
            return false; // Cooldown in effect
        }

        return true; // Allowed to proceed
    }
}

export default Cooldown;