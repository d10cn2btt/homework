import { Link } from 'react-router-dom';

const ERROR_CONFIG = {
  401: {
    title: 'Chưa đăng nhập',
    message: 'Bạn cần đăng nhập để truy cập trang này.',
    action: { label: 'Đi đến trang đăng nhập', href: '/login' },
  },
  403: {
    title: 'Không có quyền truy cập',
    message: 'Bạn không có quyền truy cập vào trang này.',
    action: { label: 'Về trang chủ', href: '/dashboard' },
  },
  404: {
    title: 'Không tìm thấy trang',
    message: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.',
    action: { label: 'Về trang chủ', href: '/dashboard' },
  },
  500: {
    title: 'Lỗi máy chủ',
    message: 'Đã xảy ra lỗi phía máy chủ. Vui lòng thử lại sau.',
    action: { label: 'Về trang chủ', href: '/dashboard' },
  },
};

export default function ErrorPage({ code = 404 }) {
  const config = ERROR_CONFIG[code] || ERROR_CONFIG[404];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-gray-300 mb-4">{code}</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{config.title}</h1>
        <p className="text-gray-500 mb-6">{config.message}</p>
        <Link
          to={config.action.href}
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
        >
          {config.action.label}
        </Link>
      </div>
    </div>
  );
}
