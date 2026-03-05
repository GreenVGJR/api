import { Hono } from 'hono';

const app = new Hono();
const timezones = Intl.supportedValuesOf('timeZone');

app.get('/timezone', async (c) => {
    const q = c.req.query('q');
    if (!q) {
        return c.json({ error: "Missing parameter 'q'" }, 400);
    }

    const query = q.toLowerCase().trim().replace(/\s+/g, '_');
    let exactMatches: string[] = [];
    let softMatches: string[] = [];
    const d = new Date();
    
    // Check if query is something like "gmt+7" or "utc-4"
    const gmtUtcMatch = query.match(/^(?:gmt|utc)\s*([+-]?)\s*(\d{1,2})(?::?(\d{2}))?$/);
    
    if (gmtUtcMatch) {
        const sign = gmtUtcMatch[1] === '-' ? -1 : 1;
        const hrs = parseInt(gmtUtcMatch[2], 10);
        const mins = gmtUtcMatch[3] ? parseInt(gmtUtcMatch[3], 10) : 0;
        const targetOffsetMinutes = sign * (hrs * 60 + mins);

        // Find all timezones that currently have this offset
        softMatches = timezones.filter(tz => {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                timeZoneName: 'longOffset',
            });
            const parts = formatter.formatToParts(d);
            const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT';
            
            let gmtStr = offsetPart.replace('GMT', '');
            if (gmtStr === '') gmtStr = '+00:00';
            
            const s = gmtStr.startsWith('-') ? -1 : 1;
            const m = gmtStr.match(/([+-])?(\d{2}):?(\d{2})/);
            let tzOffsetMinutes = 0;
            if (m) {
                tzOffsetMinutes = s * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
            }
            return tzOffsetMinutes === targetOffsetMinutes;
        });
        
        // Prioritize major cities/regions as the "exact" ones if we have any, or just use the first one
        if (softMatches.length > 0) {
            // Sort to prioritize regions like Asia, Europe over Antarctica
            softMatches.sort((a, b) => {
                const aPri = (a.startsWith('Antarctica/') || a.startsWith('Etc/')) ? 1 : 0;
                const bPri = (b.startsWith('Antarctica/') || b.startsWith('Etc/')) ? 1 : 0;
                return aPri - bPri;
            });
            exactMatches = [softMatches[0]];
            softMatches = softMatches.slice(1);
        }
    } else {
        exactMatches = timezones.filter(tz => tz.toLowerCase() === query || tz.toLowerCase().split('/').pop() === query);
        softMatches = timezones.filter(tz => tz.toLowerCase().includes(query));
    }

    const matches = exactMatches.length > 0 ? exactMatches.concat(softMatches.filter(tz => !exactMatches.includes(tz))) : softMatches;
    
    if (matches.length === 0) {
        return c.json({ error: "Timezone not found" }, 404);
    }

    // Pick the most relevant name
    const name = matches[0];
    const similarName = matches.slice(1);

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: name,
        timeZoneName: 'longOffset',
    });
    
    // Check for DST (check January vs July offset)
    const dJan = new Date(d.getFullYear(), 0, 1);
    const dJul = new Date(d.getFullYear(), 6, 1);
    
    function getOffsetMinutes(date: Date) {
        const parts = formatter.formatToParts(date);
        const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT';
        let str = offsetPart.replace('GMT', '');
        if (str === '') str = '+00:00';
        
        const sign = str.startsWith('-') ? -1 : 1;
        const match = str.match(/([+-])?(\d{2}):?(\d{2})/);
        if(!match) return 0;
        return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));
    }
    
    const janOffsetMinutes = getOffsetMinutes(dJan);
    const julOffsetMinutes = getOffsetMinutes(dJul);
    
    const hasDst = janOffsetMinutes !== julOffsetMinutes;

    let dstDisplay = "";
    
    if (hasDst) {
        const dstOffsetMinutes = Math.max(janOffsetMinutes, julOffsetMinutes);
        const dstDate = janOffsetMinutes === dstOffsetMinutes ? dJan : dJul;
        
        const shortFmt = new Intl.DateTimeFormat('en-US', { timeZone: name, timeZoneName: 'short' });
        const shortDst = shortFmt.formatToParts(dstDate).find(p => p.type === 'timeZoneName')?.value || '';
        
        const signDst = dstOffsetMinutes >= 0 ? '+' : '-';
        const dstFormat = signDst + Math.abs(dstOffsetMinutes / 60);
        
        // Only append the parenthetical offset if short form name doesn't already indicate a GMT string
        if (shortDst.match(/^GMT|\+|-/i)) {
             dstDisplay = shortDst;
        } else {
             dstDisplay = `${shortDst} (${dstFormat})`;
        }
    }
    
    const dNow = new Date();
    const currentOffsetMinutes = getOffsetMinutes(dNow);
    
    // Formatting new conversion fields
    const LocaleDate = dNow.toLocaleDateString('en-US', { timeZone: name });
    const LocaleTime = dNow.toLocaleTimeString('en-US', { timeZone: name });
    const Locale = dNow.toLocaleString('en-US', { timeZone: name });
    const dateFormatted = dNow.toLocaleDateString('en-US', { timeZone: name, weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' });

    const formatterRaw = new Intl.DateTimeFormat('en-US', {
        timeZone: name,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
    const partsRaw = formatterRaw.formatToParts(dNow);
    const p: any = {};
    partsRaw.forEach(part => { p[part.type] = part.value; });
    
    const isoOffsetStr = (currentOffsetMinutes >= 0 ? '+' : '-') + 
                         String(Math.abs(Math.floor(currentOffsetMinutes / 60))).padStart(2, '0') + ':' + 
                         String(Math.abs(currentOffsetMinutes % 60)).padStart(2, '0');

    const isoLocal = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${isoOffsetStr}`;
    // Construct local-centric "UTC" string (showing local time bits)
    const utcLocal = dNow.toLocaleDateString('en-US', { timeZone: name, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) + 
                     ', ' + p.hour + ':' + p.minute + ':' + p.second + ' GMT' + isoOffsetStr;

    return c.json({
        data: {
            name,
            conversion: {
                LocaleDate,
                LocaleTime,
                Locale,
                Date: dateFormatted,
                ISO: isoLocal,
                UTC: utcLocal,
                Time: `${p.hour}:${p.minute}:${p.second}`
            },
            offsetTimeM: String(currentOffsetMinutes),
            offsetTimeS: String(currentOffsetMinutes * 60),
            offsetTimeMS: String(currentOffsetMinutes * 60 * 1000),
            similarName
        }
    });
});

export default app;
