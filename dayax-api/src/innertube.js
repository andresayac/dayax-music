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
        instance = await Innertube.create({
            lang: 'es-419',
            location: 'CO',
            cache: new UniversalCache(false),
            generate_session_locally: true,
        });
        console.log(`[Innertube] Ready in ${(performance.now() - start).toFixed(0)}ms`);
    }
    return instance;
}

// Force re-creation (useful if session expires)
export function resetInnertube() {
    instance = null;
}
