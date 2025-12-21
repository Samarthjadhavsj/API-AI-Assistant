// Helper function to check if Pluely API should be used
export async function shouldUsePluelyAPI(): Promise<boolean> {
  // Force disabled - always use direct AI providers
  return false;
}
