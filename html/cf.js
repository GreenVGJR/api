async function xorDecrypt(base64, key) {
    const msgUint8 = new TextEncoder().encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const mask = new Uint8Array(hashBuffer);

    let standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    while (standardBase64.length % 4) standardBase64 += '=';

    const binaryString = atob(standardBase64);
    const data = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        data[i] = binaryString.charCodeAt(i) ^ mask[i % mask.length];
    }
    return new TextDecoder().decode(data);
}

async function xorEncrypt(text, key) {
    const msgUint8 = new TextEncoder().encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const mask = new Uint8Array(hashBuffer);
    const data = new TextEncoder().encode(text);
    for (let i = 0; i < data.length; i++) {
        data[i] ^= mask[i % mask.length];
    }
    const binaryString = String.fromCharCode(...data);
    const base64 = btoa(binaryString);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function solveChallenge(challenge, ouuid, ssk) {
    try {
        const [base64xt, validType, [slicekf, ip], time, xtIndex, keyIndex] = JSON.parse(await xorDecrypt(challenge, ssk));
        if (validType !== 1000) return null;

        const xt = JSON.parse(atob(base64xt));
        const key = xt[keyIndex];
        const encryptedValue = xt[xtIndex];
        const secretValue = await xorDecrypt(encryptedValue, key);

        const data = atob(time) + secretValue.toString() + ip + (ouuid ? ouuid.replaceAll('-', '') : '');
        const msgUint8 = new TextEncoder().encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));

        const base64 = btoa(String.fromCharCode(...hashArray));
        const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const solution = JSON.stringify([base64url, validType, [slicekf, ip], time, xtIndex, keyIndex]);
        return await xorEncrypt(solution, key);
    } catch (e) {
        console.error(e);
        return null;
    }
}

clientSecretKey = getComputedStyle(document.documentElement).getPropertyValue(atob('LS14LXNpbGVudC12ZXJpZnktc3RhdGlj')).trim().replace(/"/g, '');
document.documentElement.style.setProperty(atob('LS14LXNpbGVudC12ZXJpZnktc3RhdGlj'), '');