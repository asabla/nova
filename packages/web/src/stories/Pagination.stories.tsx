import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pagination } from "@/components/ui/Pagination";

const meta: Meta<typeof Pagination> = {
  title: "Components/Pagination",
  component: Pagination,
  tags: ["autodocs"],
  argTypes: {
    page: { control: { type: "number", min: 1 } },
    totalPages: { control: { type: "number", min: 1 } },
    showInfo: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Pagination>;

function InteractivePagination(props: Partial<React.ComponentProps<typeof Pagination>> & { totalPages: number }) {
  const [page, setPage] = useState(props.page ?? 1);
  return (
    <Pagination
      page={page}
      totalPages={props.totalPages}
      onPageChange={setPage}
      {...props}
    />
  );
}

export const Default: Story = {
  render: () => (
    <div className="w-96">
      <InteractivePagination totalPages={10} />
    </div>
  ),
};

export const WithInfo: Story = {
  render: () => (
    <div className="w-96">
      <InteractivePagination
        totalPages={12}
        totalItems={115}
        pageSize={10}
        showInfo
      />
    </div>
  ),
};

export const FirstPage: Story = {
  render: () => (
    <div className="w-96">
      <Pagination page={1} totalPages={5} onPageChange={() => {}} showInfo totalItems={48} pageSize={10} />
    </div>
  ),
};

export const LastPage: Story = {
  render: () => (
    <div className="w-96">
      <Pagination page={5} totalPages={5} onPageChange={() => {}} showInfo totalItems={48} pageSize={10} />
    </div>
  ),
};

export const SinglePage: Story = {
  render: () => (
    <div className="w-96">
      <Pagination page={1} totalPages={1} onPageChange={() => {}} showInfo totalItems={3} pageSize={10} />
    </div>
  ),
};

/** Showcases all pagination patterns */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-10 w-[480px]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Interactive</p>
        <div className="p-4 rounded-xl bg-surface-secondary border border-border">
          <InteractivePagination totalPages={10} totalItems={97} pageSize={10} showInfo />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Boundary States</p>
        <div className="space-y-3">
          <div className="p-3 rounded-lg border border-border">
            <p className="text-[10px] font-mono text-text-tertiary mb-2">First page</p>
            <Pagination page={1} totalPages={8} onPageChange={() => {}} showInfo totalItems={78} pageSize={10} />
          </div>
          <div className="p-3 rounded-lg border border-border">
            <p className="text-[10px] font-mono text-text-tertiary mb-2">Middle page</p>
            <Pagination page={4} totalPages={8} onPageChange={() => {}} showInfo totalItems={78} pageSize={10} />
          </div>
          <div className="p-3 rounded-lg border border-border">
            <p className="text-[10px] font-mono text-text-tertiary mb-2">Last page</p>
            <Pagination page={8} totalPages={8} onPageChange={() => {}} showInfo totalItems={78} pageSize={10} />
          </div>
          <div className="p-3 rounded-lg border border-border">
            <p className="text-[10px] font-mono text-text-tertiary mb-2">Single page</p>
            <Pagination page={1} totalPages={1} onPageChange={() => {}} showInfo totalItems={5} pageSize={10} />
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Minimal (no info)</p>
        <InteractivePagination totalPages={20} />
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
