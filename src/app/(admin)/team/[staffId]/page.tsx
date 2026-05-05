import TeamEditorPage from "@/components/admin/pages/TeamEditorPage";

export default async function StaffDetailRoutePage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const { staffId } = await params;
  return <TeamEditorPage staffId={staffId} />;
}
