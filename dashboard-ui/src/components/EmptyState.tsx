export function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center"
      style={{
        borderColor: 'var(--color-border-subtle)',
        color: 'var(--color-text-secondary)',
      }}
    >
      <div className="text-4xl" aria-hidden>
        🎬
      </div>
      <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
        مفيش فيديوهات للمتابعة لسه
      </h3>
      <p className="max-w-md text-sm">
        اضغط <span style={{ color: 'var(--color-brand-accent)' }}>"+ Add Video"</span> في
        الأعلى وحط الـ path لفيديو خام عشان تبدأ الـ pipeline.
      </p>
    </div>
  );
}
