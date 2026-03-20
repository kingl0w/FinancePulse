export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="px-4 py-3">{children}</main>;
}
