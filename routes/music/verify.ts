import { Hono } from "hono";
import { verifyAltchaCookie } from "../../functions/altchaChallenge.js";
import { ipToNumber } from "../../functions/musicChallenges.js";
import { consumeMusicVsSession, hasMusicVsSession, MUSIC_VS_CHANNEL, signMusicVsToken } from "../../functions/musicVsChallenge.js";

const app = new Hono();

const VERIFY_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="dark" /><title>Browser verification</title><script>window.opener=null</script><link rel="modulepreload" href="/altcha.js" /><style>*{box-sizing:border-box}html,body{height:100%}body{margin:0;min-height:100dvh;display:flex;align-items:flex-start;padding:clamp(24px,6vw,40px);background:#0b0704;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#fff}main{max-width:420px}h1{margin:0 0 12px;font-size:19px}p{font-size:13px;line-height:1.4;color:#d8d2cc}altcha-widget{display:block;margin-top:16px}</style></head><body><main><h1>Verifying your browser</h1><p hidden></p><altcha-widget challenge="/altcha/challenge" auto="onload" display="standard" workers="2" hide-logo></altcha-widget></main><script type="module" src="/altcha.js"></script><script type="module">const w=document.querySelector("altcha-widget");const msg=document.querySelector("p");const params=new URLSearchParams(location.search);const suffix="?id="+encodeURIComponent(params.get("id")||"")+"&sid="+encodeURIComponent(params.get("sid")||"");let done=false;const fail=(text)=>{if(done)return;done=true;if(msg){msg.hidden=false;msg.textContent=text}};const go=async()=>{if(done)return;done=true;try{const res=await fetch("/music/verify/token"+suffix,{credentials:"same-origin",cache:"no-store",headers:{Accept:"application/json"}});const data=await res.json();if(!res.ok||!data.token)throw new Error(data.error||"Verification failed");const channel=new BroadcastChannel(${JSON.stringify(MUSIC_VS_CHANNEL)});channel.postMessage({type:"music-vs-verified",token:data.token});window.close();if(msg){msg.hidden=false;msg.textContent="Verified. You can close this tab."}}catch(e){fail((e&&e.message)||"Verification failed. Close this tab and retry.")}};const attach=()=>{if(!w)return;w.addEventListener("verified",go);w.addEventListener("error",()=>fail("Verification failed. Close this tab and retry."));if(typeof w.getState==="function"&&w.getState()==="verified")go()};if(document.readyState==="complete")attach();else window.addEventListener("load",attach);</script></body></html>`;

app.get("/verify", (c) => {
	if (!hasMusicVsSession(c.req.query("id"), c.req.query("sid"))) return c.body(null, 404);
	c.header("Cache-Control", "no-store");
	c.header("Content-Type", "text/html; charset=utf-8");
	return c.body(VERIFY_PAGE);
});

app.get("/verify/token", async (c) => {
	c.header("Cache-Control", "no-store");
	if (!consumeMusicVsSession(c, c.req.query("id"), c.req.query("sid"))) return c.body(null, 404);
	if (!(await verifyAltchaCookie(c))) return c.json({ error: "Verification required" }, 403);
	try {
		const ua = c.req.header("user-agent") ?? "";
		const ip = ipToNumber(c.req.header("cf-connecting-ip") || c.req.header("x-real-ip") || "127.0.0.1");
		const token = await signMusicVsToken(ua, ip);
		return c.json({ token });
	} catch (e: any) {
		return c.json({ error: e?.message || "Token issuance failed" }, 500);
	}
});

export default app;
