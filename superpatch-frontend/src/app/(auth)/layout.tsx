import Image from 'next/image'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-xl">
          SP
        </div>
        <div className="flex flex-col">
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
