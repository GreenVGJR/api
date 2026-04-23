async function xorDecrypt(hex, key) {
    const msgUint8 = new TextEncoder().encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const mask = new Uint8Array(hashBuffer);
    const data = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    for (let i = 0; i < data.length; i++) {
        data[i] ^= mask[i % mask.length];
    }
    return new TextDecoder().decode(data);
}

async function solveChallenge(challenge) {
    try {
        const [base64xt, validType, [slicekf, ip], time, xtIndex, keyIndex] = JSON.parse(atob(challenge));
        if (validType !== 1000) return null;

        const xt = JSON.parse(atob(base64xt));
        const key = xt[keyIndex];
        const encryptedValue = xt[xtIndex];
        const secretValue = await xorDecrypt(encryptedValue, key);

        const data = atob(time) + secretValue.toString() + ip;
        const msgUint8 = new TextEncoder().encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));

        const base64 = btoa(String.fromCharCode(...hashArray));
        const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        return JSON.stringify([base64url, validType, [slicekf, ip], time, xtIndex, keyIndex]);
    } catch (e) {
        console.error(e);
        return null;
    }
}
