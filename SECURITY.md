# امنیت

این مخزن راهنمای همکاری است، نه محل نگهداری راز.

## گزارش مشکل امنیتی

اگر نشت توکن، کلید یا دسترسی ناخواسته دیدید، آن را در Issue عمومی، PR یا log گردش‌کار نگذارید. از [گزارش خصوصی آسیب‌پذیری](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) روی همین مخزن استفاده کنید یا به مالک [ramincsy](https://github.com/ramincsy) پیام خصوصی بدهید.

## قواعد همین پروژه

- هیچ PAT، کوکی مرورگر، رمز حساب یا کلید API در git ذخیره نشود.
- CI فقط خواندن محتوا دارد. هماهنگ‌کنندهٔ ساعتی فقط Issue، واگذاری و درخواست بررسی می‌نویسد.
- `GITHUB_TOKEN` هویت `github-actions[bot]` است و معادل فعالیت شخصی ramincsy یا backrebital-lgtm نیست.
- گردش‌کار `Hourly maintenance` رویداد `pull_request_target` را با checkout شاخهٔ پیش‌فرض اجرا می‌کند؛ کد PR اجرا نمی‌شود.
- دو حساب یک مالک‌اند؛ این را برای دور زدن بررسی مستقل یا شبیه‌سازی فعالیت انسانی به کار نبرید.

اگر توکنی اشتباهاً commit شد، آن را در GitHub revoke کنید، از تاریخچه حذفش را جداگانه برنامه‌ریزی کنید و در پیام عمومی فقط نوع راز را بگویید نه مقدار آن را.
