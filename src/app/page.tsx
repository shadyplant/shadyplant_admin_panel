import AdminShell from "@/components/admin/AdminShell";
import AdminDashboardPage from "@/components/admin/pages/AdminDashboardPage";

export default function App() {
  return (
    <AdminShell>
      <AdminDashboardPage />
    </AdminShell>
  );
}
