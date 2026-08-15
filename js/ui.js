/*
 * SaveBite
 * Common UI Engine
 *
 * Handles:
 * - Toast notifications
 * - Modal dialogs
 * - Confirm dialogs
 * - Loading states
 * - Buttons
 * - Empty states
 * - Error states
 * - Basic DOM helpers
 *
 * IMPORTANT:
 * User/database content must never be trusted as HTML.
 * Use textContent for dynamic content whenever possible.
 */


/* =========================================================
   CONSTANTS
========================================================= */

const UI_EVENTS = Object.freeze({
  TOAST:
    "savebite:toast",

  MODAL_OPEN:
    "savebite:modal-open",

  MODAL_CLOSE:
    "savebite:modal-close"
});


const TOAST_DURATION =
  4000;


/* =========================================================
   INTERNAL STATE
========================================================= */

const state = {
  toastContainer: null,

  activeModal: null,

  modalResolver: null,

  modalPreviousFocus: null
};


/* =========================================================
   DOM HELPERS
========================================================= */

function ensureDocument() {
  if (
    typeof document ===
    "undefined"
  ) {
    throw new Error(
      "SaveBite UI requires a browser document."
    );
  }
}


function createElement(
  tag,
  {
    className = "",
    text = "",
    attributes = {}
  } = {}
) {
  ensureDocument();

  const element =
    document.createElement(
      tag
    );

  if (className) {
    element.className =
      className;
  }

  if (text !== "") {
    element.textContent =
      String(text);
  }

  Object.entries(
    attributes
  ).forEach(
    ([key, value]) => {

      if (
        value === null ||
        value === undefined
      ) {
        return;
      }

      element.setAttribute(
        key,
        String(value)
      );
    }
  );

  return element;
}


/* =========================================================
   EVENT EMITTER
========================================================= */

function emit(
  eventName,
  detail = {}
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      eventName,
      {
        detail
      }
    )
  );
}


/* =========================================================
   TOAST CONTAINER
========================================================= */

function getToastContainer() {
  ensureDocument();

  if (
    state.toastContainer &&
    document.body.contains(
      state.toastContainer
    )
  ) {
    return state.toastContainer;
  }

  let container =
    document.querySelector(
      "[data-savebite-toast-container]"
    );

  if (!container) {
    container =
      createElement(
        "div",
        {
          className:
            "savebite-toast-container",

          attributes: {
            "data-savebite-toast-container":
              ""
          }
        }
      );

    document.body.appendChild(
      container
    );
  }

  state.toastContainer =
    container;

  return container;
}


/* =========================================================
   TOAST
========================================================= */

function toast(
  message,
  {
    type = "info",
    duration =
      TOAST_DURATION,
    title = "",
    dismissible = true
  } = {}
) {
  ensureDocument();

  const allowedTypes = [
    "info",
    "success",
    "warning",
    "error"
  ];

  const safeType =
    allowedTypes.includes(
      type
    )
      ? type
      : "info";

  const container =
    getToastContainer();

  const toastElement =
    createElement(
      "div",
      {
        className:
          `savebite-toast savebite-toast-${safeType}`,

        attributes: {
          role:
            safeType === "error"
              ? "alert"
              : "status",

          "aria-live":
            safeType === "error"
              ? "assertive"
              : "polite"
        }
      }
    );

  const content =
    createElement(
      "div",
      {
        className:
          "savebite-toast-content"
      }
    );

  if (title) {
    const titleElement =
      createElement(
        "strong",
        {
          className:
            "savebite-toast-title",

          text:
            title
        }
      );

    content.appendChild(
      titleElement
    );
  }

  const messageElement =
    createElement(
      "div",
      {
        className:
          "savebite-toast-message",

        text:
          message
      }
    );

  content.appendChild(
    messageElement
  );

  toastElement.appendChild(
    content
  );


  if (dismissible) {
    const closeButton =
      createElement(
        "button",
        {
          className:
            "savebite-toast-close",

          text:
            "×",

          attributes: {
            type:
              "button",

            "aria-label":
              "Dismiss notification"
          }
        }
      );

    closeButton.addEventListener(
      "click",
      () => {
        removeToast(
          toastElement
        );
      }
    );

    toastElement.appendChild(
      closeButton
    );
  }


  container.appendChild(
    toastElement
  );


  requestAnimationFrame(
    () => {
      toastElement.classList.add(
        "is-visible"
      );
    }
  );


  let timeoutId = null;

  if (
    Number(duration) > 0
  ) {
    timeoutId =
      setTimeout(
        () => {
          removeToast(
            toastElement
          );
        },
        Number(duration)
      );
  }


  emit(
    UI_EVENTS.TOAST,
    {
      type:
        safeType,

      message:
        String(message),

      element:
        toastElement
    }
  );


  return {
    element:
      toastElement,

    dismiss() {
      if (timeoutId) {
        clearTimeout(
          timeoutId
        );
      }

      removeToast(
        toastElement
      );
    }
  };
}


function removeToast(
  element
) {
  if (!element) {
    return;
  }

  element.classList.remove(
    "is-visible"
  );

  setTimeout(
    () => {
      element.remove();
    },
    250
  );
}


/* =========================================================
   SHORTCUT TOASTS
========================================================= */

function success(
  message,
  options = {}
) {
  return toast(
    message,
    {
      ...options,
      type:
        "success"
    }
  );
}


function error(
  message,
  options = {}
) {
  return toast(
    message,
    {
      ...options,
      type:
        "error"
    }
  );
}


function warning(
  message,
  options = {}
) {
  return toast(
    message,
    {
      ...options,
      type:
        "warning"
    }
  );
}


function info(
  message,
  options = {}
) {
  return toast(
    message,
    {
      ...options,
      type:
        "info"
    }
  );
}


/* =========================================================
   MODAL ROOT
========================================================= */

function getModalRoot() {
  ensureDocument();

  let root =
    document.querySelector(
      "[data-savebite-modal-root]"
    );

  if (!root) {
    root =
      createElement(
        "div",
        {
          className:
            "savebite-modal-root",

          attributes: {
            "data-savebite-modal-root":
              ""
          }
        }
      );

    document.body.appendChild(
      root
    );
  }

  return root;
}


/* =========================================================
   CLOSE ACTIVE MODAL
========================================================= */

function closeModal(
  result = false
) {
  const modal =
    state.activeModal;

  if (!modal) {
    return false;
  }

  modal.classList.remove(
    "is-open"
  );

  const resolver =
    state.modalResolver;

  state.activeModal =
    null;

  state.modalResolver =
    null;

  setTimeout(
    () => {
      modal.remove();

      document.body.classList.remove(
        "savebite-modal-open"
      );

      if (
        state.modalPreviousFocus &&
        typeof state.modalPreviousFocus.focus ===
          "function"
      ) {
        try {
          state.modalPreviousFocus.focus();
        } catch {
          // Ignore focus restoration failures.
        }
      }

      state.modalPreviousFocus =
        null;
    },
    200
  );

  if (resolver) {
    resolver(
      result
    );
  }

  emit(
    UI_EVENTS.MODAL_CLOSE,
    {
      result
    }
  );

  return true;
}


/* =========================================================
   OPEN MODAL
========================================================= */

function openModal(
  {
    title = "",
    message = "",
    content = null,
    confirmText = "OK",
    cancelText = "",
    showClose = true,
    closeOnBackdrop = true,
    closeOnEscape = true,
    danger = false
  } = {}
) {
  ensureDocument();

  if (state.activeModal) {
    closeModal(
      false
    );
  }

  const root =
    getModalRoot();

  const previousFocus =
    document.activeElement;

  state.modalPreviousFocus =
    previousFocus;


  const overlay =
    createElement(
      "div",
      {
        className:
          "savebite-modal",

        attributes: {
          role:
            "dialog",

          "aria-modal":
            "true"
        }
      }
    );


  const dialog =
    createElement(
      "div",
      {
        className:
          "savebite-modal-dialog"
      }
    );


  if (title) {
    const header =
      createElement(
        "div",
        {
          className:
            "savebite-modal-header"
        }
      );

    const heading =
      createElement(
        "h2",
        {
          className:
            "savebite-modal-title",

          text:
            title
        }
      );

    header.appendChild(
      heading
    );

    if (showClose) {
      const closeButton =
        createElement(
          "button",
          {
            className:
              "savebite-modal-close",

            text:
              "×",

            attributes: {
              type:
                "button",

              "aria-label":
                "Close dialog"
            }
          }
        );

      closeButton.addEventListener(
        "click",
        () => {
          closeModal(
            false
          );
        }
      );

      header.appendChild(
        closeButton
      );
    }

    dialog.appendChild(
      header
    );
  }


  const body =
    createElement(
      "div",
      {
        className:
          "savebite-modal-body"
      }
    );


  if (
    content instanceof Node
  ) {
    body.appendChild(
      content
    );

  } else if (
    typeof content ===
    "string"
  ) {
    /*
     * Deliberately use textContent.
     * Dynamic HTML must not be trusted.
     */
    body.textContent =
      content;

  } else if (message) {
    body.textContent =
      message;
  }


  dialog.appendChild(
    body
  );


  if (
    confirmText ||
    cancelText
  ) {
    const footer =
      createElement(
        "div",
        {
          className:
            "savebite-modal-footer"
        }
      );


    if (cancelText) {
      const cancelButton =
        createElement(
          "button",
          {
            className:
              "savebite-button savebite-button-secondary",

            text:
              cancelText,

            attributes: {
              type:
                "button"
            }
          }
        );

      cancelButton.addEventListener(
        "click",
        () => {
          closeModal(
            false
          );
        }
      );

      footer.appendChild(
        cancelButton
      );
    }


    if (confirmText) {
      const confirmButton =
        createElement(
          "button",
          {
            className:
              danger
                ? "savebite-button savebite-button-danger"
                : "savebite-button savebite-button-primary",

            text:
              confirmText,

            attributes: {
              type:
                "button"
            }
          }
        );

      confirmButton.addEventListener(
        "click",
        () => {
          closeModal(
            true
          );
        }
      );

      footer.appendChild(
        confirmButton
      );
    }


    dialog.appendChild(
      footer
    );
  }


  overlay.appendChild(
    dialog
  );

  root.appendChild(
    overlay
  );

  state.activeModal =
    overlay;


  if (
    closeOnBackdrop
  ) {
    overlay.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          overlay
        ) {
          closeModal(
            false
          );
        }
      }
    );
  }


  if (
    closeOnEscape
  ) {
    overlay.addEventListener(
      "keydown",
      event => {
        if (
          event.key ===
          "Escape"
        ) {
          event.preventDefault();

          closeModal(
            false
          );
        }
      }
    );
  }


  requestAnimationFrame(
    () => {
      overlay.classList.add(
        "is-open"
      );

      document.body.classList.add(
        "savebite-modal-open"
      );

      const focusTarget =
        dialog.querySelector(
          "button, input, select, textarea, [tabindex]:not([tabindex='-1'])"
        );

      if (focusTarget) {
        focusTarget.focus();
      }
    }
  );


  emit(
    UI_EVENTS.MODAL_OPEN,
    {
      element:
        overlay,

      title
    }
  );


  return new Promise(
    resolve => {
      state.modalResolver =
        resolve;
    }
  );
}


/* =========================================================
   ALERT
========================================================= */

function alertDialog(
  message,
  options = {}
) {
  return openModal({
    title:
      options.title ||
      "SaveBite",

    message,

    confirmText:
      options.confirmText ||
      "OK",

    cancelText:
      "",

    showClose:
      true,

    closeOnBackdrop:
      options.closeOnBackdrop ??
      true
  });
}


/* =========================================================
   CONFIRM
========================================================= */

function confirmDialog(
  message,
  options = {}
) {
  return openModal({
    title:
      options.title ||
      "Please confirm",

    message,

    confirmText:
      options.confirmText ||
      "Confirm",

    cancelText:
      options.cancelText ||
      "Cancel",

    danger:
      Boolean(
        options.danger
      ),

    showClose:
      true,

    closeOnBackdrop:
      options.closeOnBackdrop ??
      true
  });
}


/* =========================================================
   LOADING OVERLAY
========================================================= */

function showLoading(
  {
    message =
      "Please wait...",
    target = document.body
  } = {}
) {
  ensureDocument();

  if (!target) {
    target =
      document.body;
  }


  let loader =
    target.querySelector(
      ":scope > [data-savebite-loading]"
    );


  if (loader) {
    const messageElement =
      loader.querySelector(
        "[data-loading-message]"
      );

    if (messageElement) {
      messageElement.textContent =
        message;
    }

    return {
      element:
        loader,

      hide() {
        hideLoading(
          loader
        );
      }
    };
  }


  loader =
    createElement(
      "div",
      {
        className:
          "savebite-loading",

        attributes: {
          "data-savebite-loading":
            "",

          role:
            "status",

          "aria-live":
            "polite"
        }
      }
    );


  const spinner =
    createElement(
      "div",
      {
        className:
          "savebite-loading-spinner",

        attributes: {
          "aria-hidden":
            "true"
        }
      }
    );


  const messageElement =
    createElement(
      "div",
      {
        className:
          "savebite-loading-message",

        text:
          message,

        attributes: {
          "data-loading-message":
            ""
        }
      }
    );


  loader.appendChild(
    spinner
  );

  loader.appendChild(
    messageElement
  );

  target.appendChild(
    loader
  );


  requestAnimationFrame(
    () => {
      loader.classList.add(
        "is-visible"
      );
    }
  );


  return {
    element:
      loader,

    hide() {
      hideLoading(
        loader
      );
    }
  };
}


function hideLoading(
  loader = null
) {
  if (!loader) {
    loader =
      document.querySelector(
        "[data-savebite-loading]"
      );
  }

  if (!loader) {
    return;
  }

  loader.classList.remove(
    "is-visible"
  );

  setTimeout(
    () => {
      loader.remove();
    },
    200
  );
}


/* =========================================================
   BUTTON LOADING
========================================================= */

function setButtonLoading(
  button,
  loading,
  {
    text =
      "Please wait..."
  } = {}
) {
  if (
    !(button instanceof
      HTMLButtonElement) &&
    !(button instanceof
      HTMLAnchorElement)
  ) {
    return;
  }


  if (loading) {

    if (
      !button.dataset.originalText
    ) {
      button.dataset.originalText =
        button.textContent;
    }

    button.dataset.wasDisabled =
      button.disabled
        ? "true"
        : "false";

    if (
      "disabled" in button
    ) {
      button.disabled =
        true;
    }

    button.setAttribute(
      "aria-busy",
      "true"
    );

    button.textContent =
      text;

    button.classList.add(
      "is-loading"
    );

  } else {

    if (
      button.dataset.originalText
    ) {
      button.textContent =
        button.dataset.originalText;

      delete button.dataset
        .originalText;
    }

    if (
      "disabled" in button
    ) {
      button.disabled =
        button.dataset.wasDisabled ===
        "true";
    }

    delete button.dataset
      .wasDisabled;

    button.removeAttribute(
      "aria-busy"
    );

    button.classList.remove(
      "is-loading"
    );
  }
}


/* =========================================================
   EMPTY STATE
========================================================= */

function createEmptyState(
  {
    title =
      "Nothing here yet",

    message =
      "There is nothing to show right now.",

    actionText = "",

    onAction = null
  } = {}
) {
  ensureDocument();

  const container =
    createElement(
      "div",
      {
        className:
          "savebite-empty-state"
      }
    );


  const titleElement =
    createElement(
      "h3",
      {
        className:
          "savebite-empty-title",

        text:
          title
      }
    );


  const messageElement =
    createElement(
      "p",
      {
        className:
          "savebite-empty-message",

        text:
          message
      }
    );


  container.appendChild(
    titleElement
  );

  container.appendChild(
    messageElement
  );


  if (
    actionText &&
    typeof onAction ===
      "function"
  ) {
    const button =
      createElement(
        "button",
        {
          className:
            "savebite-button savebite-button-primary",

          text:
            actionText,

          attributes: {
            type:
              "button"
          }
        }
      );

    button.addEventListener(
      "click",
      onAction
    );

    container.appendChild(
      button
    );
  }


  return container;
}


/* =========================================================
   ERROR STATE
========================================================= */

function createErrorState(
  {
    title =
      "Something went wrong",

    message =
      "We could not load this content.",

    retryText =
      "Try again",

    onRetry = null
  } = {}
) {
  ensureDocument();

  const container =
    createElement(
      "div",
      {
        className:
          "savebite-error-state",

        attributes: {
          role:
            "alert"
        }
      }
    );


  const titleElement =
    createElement(
      "h3",
      {
        className:
          "savebite-error-title",

        text:
          title
      }
    );


  const messageElement =
    createElement(
      "p",
      {
        className:
          "savebite-error-message",

        text:
          message
      }
    );


  container.appendChild(
    titleElement
  );

  container.appendChild(
    messageElement
  );


  if (
    typeof onRetry ===
      "function"
  ) {
    const retryButton =
      createElement(
        "button",
        {
          className:
            "savebite-button savebite-button-primary",

          text:
            retryText,

          attributes: {
            type:
              "button"
          }
        }
      );

    retryButton.addEventListener(
      "click",
      onRetry
    );

    container.appendChild(
      retryButton
    );
  }


  return container;
}


/* =========================================================
   DISABLE / ENABLE ELEMENT
========================================================= */

function setDisabled(
  element,
  disabled = true
) {
  if (!element) {
    return;
  }

  if (
    "disabled" in element
  ) {
    element.disabled =
      Boolean(
        disabled
      );
  }

  if (disabled) {
    element.setAttribute(
      "aria-disabled",
      "true"
    );
  } else {
    element.removeAttribute(
      "aria-disabled"
    );
  }
}


/* =========================================================
   TEXT SETTER
========================================================= */

function setText(
  element,
  value
) {
  if (!element) {
    return;
  }

  element.textContent =
    String(
      value ?? ""
    );
}


/* =========================================================
   VISIBILITY
========================================================= */

function setVisible(
  element,
  visible
) {
  if (!element) {
    return;
  }

  element.hidden =
    !Boolean(
      visible
    );
}


/* =========================================================
   EXPORT
========================================================= */

export {

  UI_EVENTS,

  createElement,

  toast,

  success,
  error,
  warning,
  info,

  openModal,
  closeModal,

  alertDialog,
  confirmDialog,

  showLoading,
  hideLoading,

  setButtonLoading,

  createEmptyState,
  createErrorState,

  setDisabled,
  setText,
  setVisible

};
