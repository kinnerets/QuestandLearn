// Shown instantly during any route navigation while the server renders the page,
// so tapping feels immediate (SPA-like) even on the dynamic, data-backed screens.
export default function Loading() {
  return (
    <main className="app-shell">
      <div className="screen-body loader">
        <div className="loader-dots"><i /><i /><i /></div>
        <p>רגע…</p>
      </div>
    </main>
  );
}
