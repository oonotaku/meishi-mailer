import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'

const CONTENT = {
  ja: {
    title: 'プライバシーポリシー',
    effective: '施行日：2026年4月27日',
    operator: '運営者：大野 拓（node-bee合同会社）　連絡先：info@node-bee.com',
    sections: [
      {
        heading: '1. 収集する情報',
        body: `本サービスは以下の情報を収集します。

• 氏名・メールアドレス・会社名・役職・電話番号（名刺OCRによる読み取り）
• 名刺画像（Supabase Storageに保存）
• Googleアカウントのメールアドレス（Gmail連携を選択した場合のみ）
• 支払い情報（クレジットカード情報はStripeが処理・保管し、当アプリは保持しません）`,
      },
      {
        heading: '2. Googleユーザーデータの取り扱い（重要）',
        body: `本サービスがGmail APIを通じて取得するGoogleユーザーデータ（Gmailアドレスおよびメール送信権限）は、以下の目的にのみ使用します。

• ユーザーが登録した名刺の相手へお礼メールを送信すること

Googleユーザーデータは以下のことには使用しません。

• 広告の配信・ターゲティング
• 第三者への販売・提供
• 本来の目的以外のデータ分析

本サービスは、Google API Services User Data Policy（https://developers.google.com/terms/api-services-user-data-policy）を遵守し、Limited Use要件に準拠しています。`,
      },
      {
        heading: '3. 情報の利用目的',
        body: `収集した情報は以下の目的で利用します。

• 名刺情報の保存・管理・表示
• お礼メールの自動生成・送信
• チーム間での名刺情報共有（ユーザーが「チーム共有」を選択した場合）
• サービスの品質向上・不具合対応`,
      },
      {
        heading: '4. 第三者サービスへの情報提供',
        body: `本サービスは以下の第三者サービスを利用しており、必要な範囲でデータを提供します。

• Supabase（データベース・ファイル保存）
• Anthropic（AI処理・名刺OCR）
• SendGrid（メール送信 — SendGridを選択した場合）
• Google Gmail API（メール送信 — Gmail連携を選択した場合）
• Stripe（決済処理）

これら以外の第三者にデータを販売・提供することはありません。`,
      },
      {
        heading: '5. データの保存期間',
        body: `ユーザーがアカウントを削除した時点で、関連するすべてのデータを削除します。削除のご依頼は info@node-bee.com までお問い合わせください。`,
      },
      {
        heading: '6. ユーザーの権利',
        body: `ユーザーは以下の権利を有します。

• 保存されている自身のデータへのアクセス
• データの訂正・削除の要求
• Gmail連携の解除（プロフィール設定 → 「連携を解除する」）

ご要望は info@node-bee.com までお問い合わせください。`,
      },
      {
        heading: '7. セキュリティ',
        body: `データは暗号化された通信（HTTPS）で送受信し、Supabaseの安全なデータベースに保管します。Googleのリフレッシュトークンは暗号化して保存します。`,
      },
      {
        heading: '8. ポリシーの変更',
        body: `本ポリシーを変更する場合は、本ページ上での告知またはメールにてお知らせします。重要な変更については、施行の少なくとも7日前に通知します。`,
      },
      {
        heading: '9. お問い合わせ',
        body: `プライバシーに関するご質問・ご要望は下記までご連絡ください。\n\ninfo@node-bee.com`,
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    effective: 'Effective: April 27, 2026',
    operator: 'Operator: Taku Ono (node-bee LLC)  Contact: info@node-bee.com',
    sections: [
      {
        heading: '1. Information We Collect',
        body: `We collect the following information:

• Name, email address, company, title, and phone number (read by business card OCR)
• Business card images (stored in Supabase Storage)
• Google account email address (only when you choose Gmail integration)
• Payment information (credit card data is processed and stored by Stripe; we do not retain it)`,
      },
      {
        heading: '2. Use of Google User Data (Important)',
        body: `Google user data obtained through the Gmail API (your Gmail address and send-mail permission) is used solely for:

• Sending thank-you emails to contacts whose business cards you have scanned

We do not use Google user data for:

• Advertising or targeting
• Sale or transfer to third parties
• Any analysis beyond the stated purpose

This service complies with the Google API Services User Data Policy (https://developers.google.com/terms/api-services-user-data-policy) and adheres to its Limited Use requirements.`,
      },
      {
        heading: '3. How We Use Your Information',
        body: `Collected information is used to:

• Save, manage, and display business card contacts
• Auto-generate and send thank-you emails
• Share contact information within your team (when you select "Team" visibility)
• Improve service quality and fix bugs`,
      },
      {
        heading: '4. Third-Party Services',
        body: `We use the following third-party services and share data only as needed:

• Supabase (database and file storage)
• Anthropic (AI processing and card OCR)
• SendGrid (email delivery — when SendGrid is selected)
• Google Gmail API (email delivery — when Gmail integration is selected)
• Stripe (payment processing)

We do not sell or share your data with any other third parties.`,
      },
      {
        heading: '5. Data Retention',
        body: `All data associated with your account will be deleted when you delete your account. To request deletion, please contact info@node-bee.com.`,
      },
      {
        heading: '6. Your Rights',
        body: `You have the right to:

• Access your stored personal data
• Request correction or deletion of your data
• Disconnect Gmail integration (Profile Settings → "Disconnect")

Please send requests to info@node-bee.com.`,
      },
      {
        heading: '7. Security',
        body: `All data is transmitted over encrypted connections (HTTPS) and stored in Supabase's secure database. Google refresh tokens are stored encrypted.`,
      },
      {
        heading: '8. Policy Changes',
        body: `If we make changes to this policy, we will notify you via this page or by email. For significant changes, we will provide at least 7 days' notice before they take effect.`,
      },
      {
        heading: '9. Contact Us',
        body: `For privacy-related questions or requests, please contact:\n\ninfo@node-bee.com`,
      },
    ],
  },
}

export default function Privacy() {
  const { i18n } = useTranslation('common')
  const router = useRouter()
  const lang = i18n.language === 'en' ? 'en' : 'ja'
  const c = CONTENT[lang]

  function switchLocale() {
    const next = lang === 'ja' ? 'en' : 'ja'
    router.push(router.pathname, router.asPath, { locale: next })
  }

  return (
    <>
      <Head>
        <title>{c.title} — {lang === 'ja' ? '名刺メーラー' : 'Card Mailer'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <div className="header">
          <Link href="/" className="back-btn">←</Link>
          <span className="header-title">{c.title}</span>
          <button className="lang-btn" onClick={switchLocale}>{lang === 'ja' ? 'EN' : 'JA'}</button>
        </div>

        <div className="page">
          <p className="meta">{c.effective}</p>
          <p className="meta">{c.operator}</p>

          {c.sections.map((s) => (
            <div key={s.heading} className="section">
              <h2 className="section-heading">{s.heading}</h2>
              <div className="section-body">
                {s.body.split('\n').map((line, i) => (
                  line === '' ? <br key={i} /> :
                  line.startsWith('http') ? (
                    <a key={i} href={line} target="_blank" rel="noopener noreferrer" className="ext-link">{line}</a>
                  ) : (
                    <p key={i}>{line}</p>
                  )
                ))}
              </div>
            </div>
          ))}

          <div className="footer-links">
            <Link href="/terms" className="footer-link">
              {lang === 'ja' ? '利用規約' : 'Terms of Service'}
            </Link>
          </div>
          <p className="footer-note">© 2026 node-bee LLC</p>
        </div>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0a0a0f; color: #f0ede8; font-family: 'Noto Sans JP', sans-serif; }
      `}</style>

      <style jsx>{`
        .shell {
          min-height: 100svh;
          max-width: 430px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #1e1e2a;
          position: sticky;
          top: 0;
          background: #0a0a0f;
          z-index: 10;
        }
        .back-btn {
          background: none;
          border: none;
          color: #7b9e87;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          text-decoration: none;
        }
        .header-title {
          font-size: 16px;
          font-weight: 700;
          color: #f0ede8;
          flex: 1;
        }
        .lang-btn {
          background: none;
          border: 1px solid #2a2a3a;
          border-radius: 4px;
          color: #5a5650;
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          padding: 2px 6px;
          letter-spacing: .06em;
          flex-shrink: 0;
        }
        .lang-btn:hover { color: #7b9e87; border-color: #7b9e87; }
        .page {
          flex: 1;
          padding: 1.5rem 1.5rem 3rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .meta {
          font-size: 11px;
          color: #5a5650;
          font-family: 'DM Mono', monospace;
          line-height: 1.6;
          margin-top: -1rem;
        }
        .meta:first-of-type { margin-top: 0; }
        .section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .section-heading {
          font-size: 14px;
          font-weight: 700;
          color: #7b9e87;
          font-family: 'DM Mono', monospace;
          letter-spacing: .04em;
        }
        .section-body {
          font-size: 13px;
          color: #a09a94;
          line-height: 1.8;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .ext-link {
          color: #4a7a9b;
          word-break: break-all;
          font-size: 12px;
          font-family: 'DM Mono', monospace;
        }
        .footer-links {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-top: .5rem;
        }
        .footer-link {
          font-size: 11px;
          color: #3a3a4a;
          font-family: 'DM Mono', monospace;
          text-decoration: none;
          letter-spacing: .04em;
        }
        .footer-link:hover { color: #5a5650; }
        .footer-note {
          font-size: 11px;
          color: #3a3a4a;
          font-family: 'DM Mono', monospace;
          text-align: center;
        }
      `}</style>
    </>
  )
}

export const getStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale, ['common'])),
  },
})
