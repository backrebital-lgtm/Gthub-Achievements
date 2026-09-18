# مثال عملی Pair Extraordinaire و ایمیل noreply

این صفحه یک مسیر قابل آزمایش برای ساخت trailer رسمی `Co-authored-by` است، نه دستور تولید نشان. [Pair Extraordinaire](https://docs.github.com/en/account-and-profile/reference/profile-reference) به پردازش GitHub وابسته است و با وجود trailer تضمین نمی‌شود.

دو حساب [ramincsy](https://github.com/ramincsy) و [backrebital-lgtm](https://github.com/backrebital-lgtm) **یک مالک** دارند. ثبت هر دو نام روی یک commit همکاری دو انسان مستقل نیست و بازبینی بین آن‌ها جایگزین بازبین انسانی مستقل نمی‌شود.

## شناسهٔ عمومی را بخوانید؛ حدس نزنید

شکل خصوصی رایج GitHub این است: `ID+USERNAME@users.noreply.github.com`. مقدار `ID` همان شناسهٔ عددی حساب در [Users API](https://docs.github.com/en/rest/users/users) است و در پروفایل عمومی دیده می‌شود. حدس نزنید:

```sh
gh api users/ramincsy --jq .id
gh api users/backrebital-lgtm --jq .id
```

مقادیر تأییدشده در همین مخزن (سپتامبر ۲۰۲۶):

| حساب | `id` عمومی | نشانی noreply متناظر |
| --- | ---: | --- |
| ramincsy | 34828058 | `34828058+ramincsy@users.noreply.github.com` |
| backrebital-lgtm | 329678572 | `329678572+backrebital-lgtm@users.noreply.github.com` |

شناسهٔ عمومی ≠ اتصال ایمیل به حساب. GitHub commit را فقط وقتی به پروفایل پیوند می‌دهد که **همان نشانی در Settings → Emails همان حساب** باشد. اگر «Keep my email addresses private» روشن است، noreply نمایش‌داده‌شده در همان صفحه را عیناً بگذارید.

@backrebital-lgtm لطفاً در GitHub: **Settings → Emails** تأیید کنید که `329678572+backrebital-lgtm@users.noreply.github.com` (یا noreply دیگری که GitHub نشان می‌دهد) به حساب لینک است. @ramincsy همین کار را برای `34828058+ramincsy@users.noreply.github.com` انجام دهد. تا این تأیید، انتساب پروفایل قطعی نیست.

## trailer برای هر دو عضو

وقتی هر دو نفر واقعاً در همان commit کار کرده‌اند — و نویسندهٔ git شخص سومی مثل عامل نیست — هر همکار یک خط می‌گیرد. اگر خود ramincsy نویسندهٔ commit است، trailer او را تکرار نکنید؛ فقط همکار را بنویسید.

<!-- sample:both-coauthors -->
```
feat: count pair-path candidate commits in the progress report

Co-authored-by: ramincsy <34828058+ramincsy@users.noreply.github.com>
Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>
```
<!-- /sample:both-coauthors -->

قواعد همان [انتساب commit](attribution.fa.md) است: یک خط خالی پیش از trailerها، املای `Co-authored-by:`، و بدون دامنهٔ نمونه (`example.com`).

**squash merge پیام نهایی را بازنویسی می‌کند.** در #18 / #19 / #21 مشاهده شد: ادغام‌کننده نویسندهٔ commit روی `main` شد، trailer خودِ او حذف شد، و نویسندهٔ اصلی PR (`cursor[bot]`) به `Co-authored-by` تبدیل شد. گزارش پیشرفت pair همان commit نشسته‌روی پیش‌فرض را می‌شمارد، نه trailerهای شاخهٔ PR که squash نگه نداشته. اگر trailer لازم است باید در پیام squash/merge باقی بماند.

## آزمایش محلی قالب (بدون هل دادن)

از ریشهٔ همین مخزن اجرا کنید. این اسکریپت فقط قالب و noreply را می‌سنجد؛ اتصال Settings و Achievement را تأیید نمی‌کند.

<!-- runnable:pair-trailer -->
```sh
set -euo pipefail
node --input-type=module <<'EOF'
import {
  githubNoreplyAddress,
  parseCoAuthorTrailers,
  validateTrailer,
  githubLoginFromNoreply
} from './scripts/coauthor.mjs';

const ramincsy = githubNoreplyAddress('ramincsy', 34828058);
const peer = githubNoreplyAddress('backrebital-lgtm', 329678572);
if (ramincsy !== '34828058+ramincsy@users.noreply.github.com') throw new Error('ramincsy noreply mismatch');
if (peer !== '329678572+backrebital-lgtm@users.noreply.github.com') throw new Error('peer noreply mismatch');

const message = [
  'docs: record verified noreply trailers',
  '',
  `Co-authored-by: ramincsy <${ramincsy}>`,
  `Co-authored-by: backrebital-lgtm <${peer}>`
].join('\n');
const parsed = parseCoAuthorTrailers(message);
if (parsed.errors.length) throw new Error(parsed.errors.join('\n'));
if (parsed.trailers.length !== 2) throw new Error('expected two trailers');
for (const trailer of parsed.trailers) {
  const errors = validateTrailer(trailer, {
    authorEmail: 'cursoragent@cursor.com',
    authorLogin: 'cursor[bot]',
    participants: ['ramincsy', 'backrebital-lgtm']
  });
  if (errors.length) throw new Error(errors.join('\n'));
}
if (githubLoginFromNoreply(parsed.trailers[0].email) !== 'ramincsy') throw new Error('login 0');
if (githubLoginFromNoreply(parsed.trailers[1].email) !== 'backrebital-lgtm') throw new Error('login 1');
console.log('OK pair-trailer');
EOF
```
<!-- /runnable:pair-trailer -->

## صداقت Achievement

- رویداد قابل مشاهده ≠ نشان. جزئیات محاسبه در public preview کامل منتشر نشده است.
- گردش‌کار `Validate co-authors` فقط قالب را از API همان PR می‌خواند.
- گردش‌کار `Collaboration progress report` پس از merge، قالب را روی commit **نشسته روی شاخهٔ پیش‌فرض** می‌شمارد (نه لزوماً commitهای شاخهٔ PR)؛ اعطا را اعلام نمی‌کند.
- فعالیت با هویت `github-actions[bot]` برای ramincsy یا backrebital-lgtm شمرده نمی‌شود.
- پرسش و پاسخ ساختگی Discussions برای Galaxy Brain نسازید.

## منابع

- [نویسندگی مشترک](https://docs.github.com/en/pull-requests/how-tos/commit-changes/creating-a-commit-with-multiple-authors)
- [نشانی noreply](https://docs.github.com/en/account-and-profile/reference/email-addresses-reference)
- [Users API](https://docs.github.com/en/rest/users/users#get-a-user)
- [عیب‌یابی انتساب](attribution.fa.md)
- [ماتریس نشان‌ها](../achievements.fa.md)
