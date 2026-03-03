import { Innertube, UniversalCache, Platform } from 'youtubei.js';

// Required: JS evaluator for deciphering streaming URLs
Platform.shim.eval = async (data, env) => {
    const properties = [];
    if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`);
    if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
    const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
    return new Function(code)();
};

let instance = null;

export async function getInnertube() {
    if (!instance) {
        console.log('[Innertube] Creating instance...');
        const start = performance.now();

        const config = {
            lang: 'es-US',
            location: 'CO',
            cache: new UniversalCache(false),
            generate_session_locally: true,
        };

        // YouTube cookie — helps bypass streaming restrictions on servers.
        // Get it from your browser: open YouTube, DevTools → Application → Cookies,
        // copy the full cookie string (or at minimum the values of SID, HSID, SSID, APISID, SAPISID, __Secure-1PSID, __Secure-3PSID).
        if (process.env.YOUTUBE_COOKIE) {
            config.cookie = process.env.YOUTUBE_COOKIE;
            console.log('[Innertube] Using YouTube cookie from env');
        }

        // PoToken (Proof of Origin Token) — needed when YouTube blocks datacenter IPs.
        // Generate with: npx youtube-po-token-generator
        if (process.env.YOUTUBE_PO_TOKEN) {
            config.po_token = process.env.YOUTUBE_PO_TOKEN;
            console.log('[Innertube] Using PoToken from env');
        }

        // Visitor data — persistent visitor ID for tailored content.
        if (process.env.YOUTUBE_VISITOR_DATA) {
            config.visitor_data = process.env.YOUTUBE_VISITOR_DATA;
            console.log('[Innertube] Using visitor_data from env');
        }

        instance = await Innertube.create(config);
        console.log(`[Innertube] Ready in ${(performance.now() - start).toFixed(0)}ms`);
    }
    return instance;
}

// Force re-creation (useful if session expires)
export function resetInnertube() {
    instance = null;
}
