export const INTRO_STORAGE_KEY = 'ourlyne-pos:intro'

/**
 * Script en línea que marca <html data-intro-played> antes del primer pintado
 * si la intro ya se reprodujo en esta sesión, para que el overlay no parpadee.
 */
export const INTRO_GUARD_SCRIPT = `try{if(sessionStorage.getItem('${INTRO_STORAGE_KEY}'))document.documentElement.dataset.introPlayed='1'}catch(e){}`
