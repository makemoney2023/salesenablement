import Image from 'next/image'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black p-2">
          <Image
            src="/SuperPatch-SYMBL-3_SuperPatch_Logo_SYMBL_WHT.png"
            alt="SuperPatch Logo"
            width={48}
            height={48}
            className="object-contain"
          />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xl font-bold">SuperPatch</span>
          <span className="text-sm text-muted-foreground">Sales Enablement</span>
        </div>
      </div>
      
      {/* Auth Form */}
      {children}
      
      {/* Footer */}
      <p className="mt-8 text-center text-sm text-muted-foreground">
        SuperPatch © {new Date().getFullYear()}. Internal use only.
      </p>
    </div>
  )
}
