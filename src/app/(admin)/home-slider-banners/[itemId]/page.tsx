import HomeSliderBannerEditorPage from "@/components/admin/pages/HomeSliderBannerEditorPage";

export default async function HomeSliderBannerDetailRoutePage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  return <HomeSliderBannerEditorPage itemId={itemId} />;
}
