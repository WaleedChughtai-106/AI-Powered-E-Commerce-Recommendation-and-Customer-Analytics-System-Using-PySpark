/**
 * Page-level header used at the top of every dashboard screen.
 */
export default function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm md:text-base text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
