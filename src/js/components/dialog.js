/* -------------------------------------------------------------
   MY LOOM // CUSTOM SYSTEM-WIDE THEME-AWARE DIALOG COMPONENT
   ------------------------------------------------------------- */

/**
 * Displays a custom system-wide modal dialog.
 * If onConfirm is provided, it acts as a Confirm dialog (Cancel & Confirm buttons).
 * If onConfirm is omitted, it acts as an Alert dialog (Close button).
 * 
 * @param {string} message - The dialog description/message.
 * @param {function} [onConfirm] - Callback executed when user confirms.
 */
export function showDialog(message, onConfirm = null) {
  // Create dialog overlay container
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 99999;
    animation: dialogFadeIn 0.2s ease-out forwards;
  `;

  // Create modal box matching Bento Box UI styling using CSS variables
  const dialogBox = document.createElement('div');
  dialogBox.className = 'dialog-box';
  dialogBox.style.cssText = `
    background-color: var(--bg-base);
    border: 1.5px solid var(--accent);
    border-radius: 12px;
    padding: 2rem;
    width: 90%;
    max-width: 420px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 15px var(--accent-dim);
    text-align: center;
    color: var(--text-primary);
    font-family: var(--font-sans);
    transform: translateY(20px);
    opacity: 0;
    animation: dialogSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  `;

  // Message container
  const textEl = document.createElement('p');
  textEl.textContent = message;
  textEl.style.cssText = `
    font-size: 1rem;
    line-height: 1.6;
    margin: 0 0 1.75rem 0;
    word-break: break-word;
  `;
  dialogBox.appendChild(textEl);

  // Buttons container
  const btnGroup = document.createElement('div');
  btnGroup.style.cssText = `
    display: flex;
    justify-content: center;
    gap: 1rem;
  `;

  const destroyDialog = () => {
    dialogBox.style.animation = 'dialogSlideDown 0.2s ease-in forwards';
    overlay.style.animation = 'dialogFadeOut 0.2s ease-in forwards';
    setTimeout(() => {
      overlay.remove();
    }, 200);
  };

  if (onConfirm) {
    // Confirm Dialog Mode
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      padding: 0.6rem 1.5rem;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--accent);
      background: transparent;
      border: 1px solid var(--accent);
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s ease;
    `;
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.backgroundColor = 'var(--accent-dim)';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.backgroundColor = 'transparent';
    });
    cancelBtn.addEventListener('click', () => {
      destroyDialog();
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm';
    confirmBtn.style.cssText = `
      padding: 0.6rem 1.5rem;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--bg-base);
      background-color: var(--accent);
      border: 1px solid var(--accent);
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s ease;
    `;
    confirmBtn.addEventListener('mouseenter', () => {
      confirmBtn.style.backgroundColor = 'var(--accent-hover)';
      confirmBtn.style.borderColor = 'var(--accent-hover)';
    });
    confirmBtn.addEventListener('mouseleave', () => {
      confirmBtn.style.backgroundColor = 'var(--accent)';
      confirmBtn.style.borderColor = 'var(--accent)';
    });
    confirmBtn.addEventListener('click', () => {
      destroyDialog();
      try {
        onConfirm();
      } catch (err) {
        console.error('Error in dialog onConfirm callback:', err);
      }
    });

    btnGroup.appendChild(cancelBtn);
    btnGroup.appendChild(confirmBtn);
  } else {
    // Alert Dialog Mode
    const okBtn = document.createElement('button');
    okBtn.textContent = 'Close';
    okBtn.style.cssText = `
      padding: 0.6rem 2rem;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--bg-base);
      background-color: var(--accent);
      border: 1px solid var(--accent);
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s ease;
    `;
    okBtn.addEventListener('mouseenter', () => {
      okBtn.style.backgroundColor = 'var(--accent-hover)';
      okBtn.style.borderColor = 'var(--accent-hover)';
    });
    okBtn.addEventListener('mouseleave', () => {
      okBtn.style.backgroundColor = 'var(--accent)';
      okBtn.style.borderColor = 'var(--accent)';
    });
    okBtn.addEventListener('click', () => {
      destroyDialog();
    });

    btnGroup.appendChild(okBtn);
  }

  dialogBox.appendChild(btnGroup);
  overlay.appendChild(dialogBox);
  document.body.appendChild(overlay);
}

// Add animation keyframes to document head if missing
if (!document.getElementById('dialog-animations')) {
  const style = document.createElement('style');
  style.id = 'dialog-animations';
  style.textContent = `
    @keyframes dialogFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes dialogFadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes dialogSlideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes dialogSlideDown {
      from { transform: translateY(0); opacity: 1; }
      to { transform: translateY(20px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Displays a custom system-wide prompt dialog.
 * @param {string} message - The dialog description/message.
 * @param {string} defaultValue - The default input value.
 * @param {function} onConfirm - Callback executed when user confirms, receives the input value.
 */
export function showPrompt(message, defaultValue = '', onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background-color: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px);
    display: flex; justify-content: center; align-items: center; z-index: 99999;
    animation: dialogFadeIn 0.2s ease-out forwards;
  `;

  const dialogBox = document.createElement('div');
  dialogBox.className = 'dialog-box';
  dialogBox.style.cssText = `
    background-color: var(--bg-base); border: 1.5px solid var(--accent); border-radius: 12px;
    padding: 2rem; width: 90%; max-width: 420px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 15px var(--accent-dim);
    text-align: center; color: var(--text-primary); font-family: var(--font-sans);
    transform: translateY(20px); opacity: 0; animation: dialogSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  `;

  const textEl = document.createElement('p');
  textEl.textContent = message;
  textEl.style.cssText = `font-size: 1rem; line-height: 1.6; margin: 0 0 1rem 0; word-break: break-word;`;
  dialogBox.appendChild(textEl);

  const inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.value = defaultValue;
  inputEl.style.cssText = `
    width: 100%; padding: 0.75rem; margin-bottom: 1.75rem; border: 1px solid var(--border-color);
    border-radius: 6px; background-color: var(--bg-surface); color: var(--text-primary);
    font-family: inherit; font-size: 1rem; outline: none;
  `;
  inputEl.addEventListener('focus', () => { inputEl.style.borderColor = 'var(--accent)'; });
  inputEl.addEventListener('blur', () => { inputEl.style.borderColor = 'var(--border-color)'; });
  dialogBox.appendChild(inputEl);

  const btnGroup = document.createElement('div');
  btnGroup.style.cssText = `display: flex; justify-content: center; gap: 1rem;`;

  const destroyDialog = () => {
    dialogBox.style.animation = 'dialogSlideDown 0.2s ease-in forwards';
    overlay.style.animation = 'dialogFadeOut 0.2s ease-in forwards';
    setTimeout(() => overlay.remove(), 200);
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    padding: 0.6rem 1.5rem; font-size: 0.9rem; font-weight: 500; color: var(--accent);
    background: transparent; border: 1px solid var(--accent); border-radius: 6px; cursor: pointer; transition: all 0.2s ease;
  `;
  cancelBtn.onclick = () => destroyDialog();

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Confirm';
  confirmBtn.style.cssText = `
    padding: 0.6rem 1.5rem; font-size: 0.9rem; font-weight: 500; color: var(--bg-base);
    background-color: var(--accent); border: 1px solid var(--accent); border-radius: 6px; cursor: pointer; transition: all 0.2s ease;
  `;
  confirmBtn.onclick = () => {
    destroyDialog();
    if (onConfirm) onConfirm(inputEl.value);
  };

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      confirmBtn.click();
    } else if (e.key === 'Escape') {
      cancelBtn.click();
    }
  });

  btnGroup.appendChild(cancelBtn);
  btnGroup.appendChild(confirmBtn);
  dialogBox.appendChild(btnGroup);
  overlay.appendChild(dialogBox);
  document.body.appendChild(overlay);

  setTimeout(() => inputEl.focus(), 100);
}
