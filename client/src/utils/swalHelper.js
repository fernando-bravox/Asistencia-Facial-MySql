import Swal from "sweetalert2";

/**
 * Muestra una alerta de SweetAlert2 con auto-cierre.
 * @param {string} type - 'success', 'error', 'warning', 'info'
 * @param {string} title - Título de la alerta
 * @param {string} text - Mensaje detallado
 * @param {number} timer - Tiempo en ms para cerrar (defecto 2000)
 */
export const showAlert = (type, title, text, timer = 2000) => {
  Swal.fire({
    icon: type,
    title: title,
    text: text,
    timer: timer,
    showConfirmButton: false,
    timerProgressBar: true,
  });
};

export default showAlert;
