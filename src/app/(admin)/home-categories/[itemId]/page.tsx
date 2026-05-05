import HomeCategoryEditorPage from "@/components/admin/pages/HomeCategoryEditorPage";

export default async function HomeCategoryDetailRoutePage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  return <HomeCategoryEditorPage itemId={itemId} />;
}
