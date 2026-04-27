import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'

const CONTENT = {
  ja: {
    title: '利用規約',
    effective: '施行日：2026年4月27日',
    operator: '運営者：大野 拓（node-bee合同会社）　連絡先：info@node-bee.com',
    sections: [
      {
        heading: '1. サービスの概要',
        body: `名刺メーラー（以下「本サービス」）は、スマートフォンで名刺を撮影し、AIによるOCRで名前・会社名・メールアドレスを読み取り、お礼メールを自動生成・送信するサービスです。本規約は、本サービスを利用するすべてのユーザーに適用されます。`,
      },
      {
        heading: '2. 利用資格',
        body: `本サービスは以下の条件を満たすユーザーのみが利用できます。

• 13歳以上であること
• アカウントを登録していること
• 本規約に同意していること

未成年者が利用する場合は、保護者の同意が必要です。`,
      },
      {
        heading: '3. 禁止事項',
        body: `ユーザーは以下の行為を行ってはなりません。

• スパムや迷惑メールの送信
• 他者へのなりすまし・虚偽情報の登録
• 違法行為または違法行為を助長する目的での使用
• 本サービスの逆コンパイル・リバースエンジニアリング・改ざん
• 本サービスへの不正アクセスや過度な負荷をかける行為
• 第三者の知的財産権・プライバシーを侵害する行為`,
      },
      {
        heading: '4. サービスの提供',
        body: `本サービスは以下のプランを提供します。

• Freeプラン：月10回までのスキャン
• Proプラン（¥980/月）：月100回までのスキャン

サービスの内容・料金・スキャン上限は、ユーザーへの事前通知のうえ変更される場合があります。また、メンテナンスや障害等によりサービスが一時的に利用できない場合があります。`,
      },
      {
        heading: '5. 支払い・返金',
        body: `Proプランの料金はStripeを通じて決済されます。

• サブスクリプションはいつでもキャンセル可能です。キャンセル後は当月末までサービスを利用できます。
• 原則として、支払い済みの料金は返金しません。
• ただし、サービス上の重大な不具合等により利用できなかった場合は、info@node-bee.com にお問い合わせください。個別に対応します。`,
      },
      {
        heading: '6. 知的財産',
        body: `本サービスのデザイン・コード・ロゴ等の知的財産はnode-bee合同会社に帰属します。

ユーザーが本サービスに登録した名刺情報・メモ等のデータは、ユーザー自身に帰属します。当社はユーザーデータを本サービスの提供目的以外に利用しません。`,
      },
      {
        heading: '7. 免責事項',
        body: `本サービスは以下について保証しません。

• メールの送達（受信側のフィルタリング等により届かない場合があります）
• OCRの読み取り精度（名刺のデザイン・画質により誤認識が生じる場合があります）
• サービスの継続的な提供・無停止稼働

当社は、本サービスの利用または利用不能により生じた損害について、法律上の責任を負う場合を除き、責任を負いません。`,
      },
      {
        heading: '8. アカウントの停止・削除',
        body: `当社は、ユーザーが本規約に違反した場合、事前通知なくアカウントを停止または削除する場合があります。

ユーザーはいつでもアカウントを削除できます。削除のご依頼は info@node-bee.com までお問い合わせください。`,
      },
      {
        heading: '9. 準拠法・管轄',
        body: `本規約は日本法に準拠します。本サービスに関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。`,
      },
      {
        heading: '10. お問い合わせ',
        body: `本規約に関するご質問は下記までご連絡ください。\n\ninfo@node-bee.com`,
      },
    ],
    footerLinks: [
      { href: '/privacy', label: 'プライバシーポリシー' },
    ],
  },
  en: {
    title: 'Terms of Service',
    effective: 'Effective: April 27, 2026',
    operator: 'Operator: Taku Ono (node-bee LLC)  Contact: info@node-bee.com',
    sections: [
      {
        heading: '1. Overview',
        body: `Card Mailer (the "Service") lets you photograph business cards, extract contact information via AI OCR, and automatically compose and send thank-you emails. These Terms of Service apply to all users of the Service.`,
      },
      {
        heading: '2. Eligibility',
        body: `You may use the Service only if you:

• Are at least 13 years old
• Have registered an account
• Agree to these Terms

If you are a minor, you must have your parent or guardian's consent.`,
      },
      {
        heading: '3. Prohibited Activities',
        body: `You may not:

• Send spam or unsolicited emails
• Impersonate others or register false information
• Use the Service for illegal purposes or to facilitate illegal activity
• Decompile, reverse-engineer, or tamper with the Service
• Attempt unauthorized access or place excessive load on the Service
• Infringe the intellectual property rights or privacy of third parties`,
      },
      {
        heading: '4. Service Plans',
        body: `The Service offers the following plans:

• Free plan: up to 10 scans per month
• Pro plan (¥980/month): up to 100 scans per month

Plan features, pricing, and scan limits may change with advance notice to users. The Service may also be temporarily unavailable due to maintenance or outages.`,
      },
      {
        heading: '5. Payment & Refunds',
        body: `Pro plan payments are processed by Stripe.

• You may cancel your subscription at any time. Access continues until the end of the current billing period.
• Payments are generally non-refundable.
• If you were unable to use the Service due to a significant service failure, please contact info@node-bee.com and we will review your case individually.`,
      },
      {
        heading: '6. Intellectual Property',
        body: `The design, code, logo, and other intellectual property of the Service belong to node-bee LLC.

Data you register in the Service (business card information, notes, etc.) remains your property. We will not use your data for any purpose beyond providing the Service.`,
      },
      {
        heading: '7. Disclaimer of Warranties',
        body: `The Service does not guarantee:

• Email delivery (messages may be filtered by the recipient's mail system)
• OCR accuracy (misreadings may occur depending on card design or image quality)
• Uninterrupted or error-free operation

To the extent permitted by law, we are not liable for damages arising from your use of or inability to use the Service.`,
      },
      {
        heading: '8. Account Suspension & Deletion',
        body: `We may suspend or delete your account without prior notice if you violate these Terms.

You may delete your account at any time. To request deletion, contact info@node-bee.com.`,
      },
      {
        heading: '9. Governing Law & Jurisdiction',
        body: `These Terms are governed by the laws of Japan. Any disputes relating to the Service shall be subject to the exclusive jurisdiction of the Tokyo District Court as the court of first instance.`,
      },
      {
        heading: '10. Contact',
        body: `For questions about these Terms, please contact:\n\ninfo@node-bee.com`,
      },
    ],
    footerLinks: [
      { href: '/privacy', label: 'Privacy Policy' },
    ],
  },
}

export default function Terms() {
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
          <button className="back-btn" onClick={() => router.back()}>←</button>
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
            {c.footerLinks.map(link => (
              <Link key={link.href} href={link.href} className="footer-link">{link.label}</Link>
            ))}
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
