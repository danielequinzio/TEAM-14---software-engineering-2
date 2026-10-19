// Title and one-line purpose of a screen. The heading takes focus when the
// customer opens the screen from the menu (see App.jsx).
export default function ScreenHead({ title, children }) {
  return (
    <header className="screen-head">
      <h1 id="page-title" className="screen-title" tabIndex={-1}>
        {title}
      </h1>
      <p className="screen-lead">{children}</p>
    </header>
  );
}
