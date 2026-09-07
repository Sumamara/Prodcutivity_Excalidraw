import { shiftISO, todayISO } from "./dates";
import "./DateBar.css";

/**
 * Selector de fecha global. Va en la barra de pestañas, a la derecha.
 * ◀ ▶ para día anterior/siguiente, un <input type="date"> nativo (calendario
 * en escritorio, rueda en iPad) y un botón "Hoy" cuando no estás en hoy.
 */
export function DateBar({
  date,
  onChange,
}: {
  date: string;
  onChange: (iso: string) => void;
}) {
  const today = todayISO();

  return (
    <div className="date-bar">
      <button
        type="button"
        className="date-nav"
        aria-label="Día anterior"
        onClick={() => onChange(shiftISO(date, -1))}
      >
        ◀
      </button>

      <input
        type="date"
        className="date-input"
        value={date}
        aria-label="Fecha"
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      />

      <button
        type="button"
        className="date-nav"
        aria-label="Día siguiente"
        onClick={() => onChange(shiftISO(date, 1))}
      >
        ▶
      </button>

      {date !== today && (
        <button
          type="button"
          className="date-today"
          onClick={() => onChange(today)}
        >
          Hoy
        </button>
      )}
    </div>
  );
}
