import { NAME_MAX_LENGTH, checkName } from '../logic/leaderboard';

// A small HTML form over the game for typing a leaderboard name (the canvas can't
// do text input, and a real input brings up the phone's keyboard).

const NAME_KEY = 'duckdefense.name';
const STYLE_ID = 'dd-name-form-style';

const CSS = `
.dd-modal { position: fixed; inset: 0; z-index: 20; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 8vh; background: rgba(13, 27, 61, 0.55); touch-action: auto; font-family: Fredoka, "Arial Rounded MT Bold", Arial, sans-serif; }
.dd-card { width: min(420px, 90vw); background: #fff7e6; border: 4px solid #2b2233; border-radius: 22px;
  padding: 20px 22px; box-shadow: 0 8px 0 rgba(0, 0, 0, 0.25); color: #2b2233; }
.dd-card h2 { margin: 0 0 12px; font-size: 26px; font-weight: 700; }
.dd-card input { width: 100%; box-sizing: border-box; font: 600 26px Fredoka, Arial, sans-serif; padding: 10px 14px;
  border: 3px solid #2b2233; border-radius: 14px; outline: none; user-select: text; -webkit-user-select: text; }
.dd-card input:focus { border-color: #3d8fe0; }
.dd-error { min-height: 22px; margin: 8px 2px 0; color: #e0334f; font-size: 18px; font-weight: 600; }
.dd-buttons { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
.dd-buttons button { font: 700 22px Fredoka, Arial, sans-serif; border: 3px solid #2b2233; border-radius: 16px;
  padding: 10px 20px; color: #fff; box-shadow: 0 5px 0 rgba(0, 0, 0, 0.25); cursor: pointer; }
.dd-buttons button:active { transform: translateY(3px); box-shadow: 0 2px 0 rgba(0, 0, 0, 0.25); }
.dd-buttons button:disabled { opacity: 0.6; }
.dd-cancel { background: #3d8fe0; }
.dd-ok { background: #3fbf5f; }
`;

function rememberedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Not remembered this time.
  }
}

/**
 * Asks for a name. `submit` posts it and resolves to an error message, or undefined on
 * success (the form then closes). Resolves true if posted, false if cancelled.
 */
export function askForName(submit: (name: string) => Promise<string | undefined>): Promise<boolean> {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.append(style);
  }

  const modal = document.createElement('div');
  modal.className = 'dd-modal';
  modal.innerHTML = `
    <form class="dd-card">
      <h2>Put your name on the board!</h2>
      <input name="name" maxlength="${NAME_MAX_LENGTH}" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Your name" />
      <p class="dd-error" aria-live="polite"></p>
      <div class="dd-buttons">
        <button type="button" class="dd-cancel">Cancel</button>
        <button type="submit" class="dd-ok">Post</button>
      </div>
    </form>`;
  document.body.append(modal);

  const form = modal.querySelector('form')!;
  const input = modal.querySelector('input')!;
  const error = modal.querySelector<HTMLElement>('.dd-error')!;
  const ok = modal.querySelector<HTMLButtonElement>('.dd-ok')!;
  input.value = rememberedName();
  setTimeout(() => input.focus(), 50);

  return new Promise((resolve) => {
    const close = (posted: boolean) => {
      modal.remove();
      resolve(posted);
    };
    modal.querySelector('.dd-cancel')!.addEventListener('click', () => close(false));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const check = checkName(input.value);
      if (!check.ok) {
        error.textContent = check.reason;
        return;
      }
      ok.disabled = true;
      error.textContent = '';
      const problem = await submit(check.name);
      ok.disabled = false;
      if (problem) {
        error.textContent = problem;
        return;
      }
      rememberName(check.name);
      close(true);
    });
  });
}
