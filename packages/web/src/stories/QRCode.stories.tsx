import type { Meta, StoryObj } from "@storybook/react-vite";
import { QRCode } from "@/components/ui/QRCode";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Shield } from "lucide-react";

const meta: Meta<typeof QRCode> = {
  title: "Components/QRCode",
  component: QRCode,
  tags: ["autodocs"],
  argTypes: {
    data: { control: "text" },
    size: { control: { type: "range", min: 64, max: 384, step: 16 } },
  },
};

export default meta;
type Story = StoryObj<typeof QRCode>;

export const Default: Story = {
  args: {
    data: "https://nova.example.com",
    size: 192,
  },
};

export const LargeSize: Story = {
  args: {
    data: "https://nova.example.com/invite/abc123",
    size: 320,
  },
};

export const OTPAuthURI: Story = {
  render: () => (
    <QRCode
      data="otpauth://totp/NOVA:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=NOVA&algorithm=SHA1&digits=6&period=30"
      size={192}
    />
  ),
};

export const InCard: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <CardTitle>Set up authenticator</CardTitle>
        </div>
        <CardDescription>
          Scan this QR code with your authenticator app to enable two-factor authentication.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl border border-border p-3 bg-white">
            <QRCode
              data="otpauth://totp/NOVA:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=NOVA&algorithm=SHA1&digits=6&period=30"
              size={180}
            />
          </div>
          <div className="text-center space-y-1">
            <p className="text-xs text-text-tertiary">Can't scan? Enter this key manually:</p>
            <code className="text-xs font-mono text-text bg-surface-tertiary px-2 py-1 rounded select-all">
              JBSWY3DPEHPK3PXP
            </code>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
};

/** Showcases all QR code patterns */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Sizes</p>
        <div className="flex items-end gap-6">
          <div className="text-center space-y-2">
            <QRCode data="https://nova.example.com" size={96} />
            <p className="text-[10px] font-mono text-text-tertiary">96px</p>
          </div>
          <div className="text-center space-y-2">
            <QRCode data="https://nova.example.com" size={148} />
            <p className="text-[10px] font-mono text-text-tertiary">148px</p>
          </div>
          <div className="text-center space-y-2">
            <QRCode data="https://nova.example.com" size={192} />
            <p className="text-[10px] font-mono text-text-tertiary">192px</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Data Density</p>
        <div className="flex items-start gap-6">
          <div className="text-center space-y-2">
            <div className="rounded-lg border border-border p-2 bg-white inline-block">
              <QRCode data="HELLO" size={148} />
            </div>
            <p className="text-[10px] text-text-tertiary">Short text</p>
          </div>
          <div className="text-center space-y-2">
            <div className="rounded-lg border border-border p-2 bg-white inline-block">
              <QRCode data="https://nova.example.com/workspace/abc123/settings/security" size={148} />
            </div>
            <p className="text-[10px] text-text-tertiary">Long URL</p>
          </div>
          <div className="text-center space-y-2">
            <div className="rounded-lg border border-border p-2 bg-white inline-block">
              <QRCode
                data="otpauth://totp/NOVA:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=NOVA&algorithm=SHA1&digits=6&period=30"
                size={148}
              />
            </div>
            <p className="text-[10px] text-text-tertiary">OTP Auth URI</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">MFA Setup Flow</p>
        <Card className="w-80">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-primary" />
              <CardTitle>Two-Factor Authentication</CardTitle>
            </div>
            <CardDescription>
              Scan the QR code with Google Authenticator, Authy, or any TOTP-compatible app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl border border-border p-3 bg-white">
                <QRCode
                  data="otpauth://totp/NOVA:admin@nova.ai?secret=JBSWY3DPEHPK3PXP&issuer=NOVA"
                  size={160}
                />
              </div>
              <Badge variant="success">Ready to scan</Badge>
              <code className="text-[10px] font-mono text-text-tertiary bg-surface-tertiary px-2 py-1 rounded select-all tracking-widest">
                JBSW Y3DP EHPK 3PXP
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
