import Head from 'next/head'

const GREEN = '#16a34a'
const BG = '#0a0f0a'

function Card({ children, style }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '20px',
      ...style,
    }}>
      {children}
    </div>
  )
}

export default function LpIndependent() {
  return (
    <>
      <Head>
        <title>次のキャリアの準備は、人脈から | Koryu</title>
        <meta name="description" content="転職・独立を考えたとき、あなたに連絡できる人は何人いますか？Koryuは名刺交換した出会いをSNS繋がりと交流履歴で資産に変えるアプリです。" />
        <meta property="og:title" content="名刺交換した人たちは、あなたの資産だ。" />
        <meta property="og:description" content="転職・独立・副業——次のキャリアを動かすのは、今まで出会ってきた人たちとの繋がり。" />
        <meta property="og:url" content="https://koryu.app/lp/independent" />
        <meta name="robots" content="noindex" />
      </Head>

      <div style={{
        background: BG,
        minHeight: '100vh',
        color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        <div style={{ maxWidth: 430, margin: '0 auto' }}>

          {/* ── Hero ── */}
          <section style={{ padding: '56px 20px 40px' }}>
            <p style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: GREEN,
              marginBottom: 20,
            }}>
              for ambitious professionals
            </p>

            <h1 style={{
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1.45,
              marginBottom: 20,
              color: '#fff',
            }}>
              名刺交換した人たちは、<br />
              あなたの資産だ。<br />
              眠らせるな。
            </h1>

            <p style={{
              fontSize: 15,
              lineHeight: 1.8,
              color: 'rgba(255,255,255,0.65)',
              marginBottom: 32,
            }}>
              転職・独立・副業——次のキャリアを動かすのは、
              今まで出会ってきた人たちとの繋がり。
              Koryuは、その出会いを流さずに、個人の武器にするアプリです。
            </p>

            <a
              href="https://koryu.app/login"
              style={{
                display: 'block',
                background: GREEN,
                color: '#fff',
                textAlign: 'center',
                padding: '16px',
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 700,
                textDecoration: 'none',
                marginBottom: 12,
                boxShadow: '0 4px 20px rgba(22,163,74,0.35)',
              }}
            >
              今すぐ無料で始める
            </a>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
              2分で登録 · クレジットカード不要
            </p>
          </section>

          {/* ── 問いかけ ── */}
          <section style={{ padding: '40px 20px' }}>
            <blockquote style={{
              borderLeft: `3px solid ${GREEN}`,
              paddingLeft: 16,
              margin: '0 0 24px',
              fontSize: 16,
              lineHeight: 1.75,
              color: 'rgba(255,255,255,0.85)',
              fontStyle: 'normal',
            }}>
              転職・独立を決めたとき、「この人に声をかけよう」と思える相手に、
              ちゃんと連絡できますか？
            </blockquote>

            <p style={{ fontSize: 15, lineHeight: 1.8, color: 'rgba(255,255,255,0.55)', margin: 0 }}>
              名刺交換は毎回する。でも気づくと、繋がり方がわからなくなっている。
              会社を離れた瞬間、その縁は消える——そんな経験、ありませんか？
            </p>
          </section>

          {/* ── 利用シーン ── */}
          <section style={{ padding: '40px 20px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#fff' }}>
              Koryuを使った動き方
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                {
                  title: '名刺交換したその場で、QRコードを見せてLINEで即つながる。',
                  body: '後で聞きそびれることがなくなる。',
                },
                {
                  title: '相手があなたのプロフィールページを見る。SNS・経歴・連絡先が一覧で伝わる。',
                  body: '「この人、面白い」と思ってもらえる第一印象を作れる。',
                },
                {
                  title: '転職・独立の報告をメールで送る。交流履歴があるから「久しぶりですが」も自然に書ける。',
                  body: '繋がりが武器になる瞬間。',
                },
              ].map((item, i) => (
                <Card key={i}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: GREEN, flexShrink: 0, marginTop: 6,
                    }} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: 6 }}>
                        {item.title}
                      </p>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: 0 }}>
                        {item.body}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* ── 機能 ── */}
          <section style={{ padding: '40px 20px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#fff' }}>
              3つの機能
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Card>
                <div style={{ fontSize: 22, marginBottom: 10 }}>🔗</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>個人URLを持つ</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 10 }}>
                  会社に依存しない、自分だけのプロフィールページ。
                  名刺・SNS・メールに使えます。
                </p>
                <p style={{
                  fontSize: 12,
                  fontFamily: '"DM Mono", "Fira Mono", monospace',
                  color: GREEN,
                  background: 'rgba(22,163,74,0.1)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  margin: 0,
                }}>
                  koryu.app/p/yourname
                </p>
              </Card>

              <Card>
                <div style={{ fontSize: 22, marginBottom: 10 }}>📱</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>QRで即SNS連携</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: 0 }}>
                  その場でLINE・WhatsAppの友達追加が完了。
                  「後でフォローします」が不要になります。
                </p>
              </Card>

              <Card>
                <div style={{ fontSize: 22, marginBottom: 10 }}>📋</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>交流履歴が自動で残る</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: 0 }}>
                  誰と・いつ・どこで出会ったかを記録。
                  いざというときに「あの人」にすぐ連絡できます。
                </p>
              </Card>
            </div>
          </section>

          {/* ── フッターCTA ── */}
          <section style={{ padding: '40px 20px 72px' }}>
            <div style={{
              background: 'rgba(22,163,74,0.08)',
              border: '1px solid rgba(22,163,74,0.2)',
              borderRadius: 20,
              padding: '32px 24px',
              textAlign: 'center',
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.5, marginBottom: 12, color: '#fff' }}>
                次のキャリアの準備を、<br />
                今日の名刺交換から始めよう
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 24, lineHeight: 1.6 }}>
                まず無料で始めて、繋がりを資産に変える。
              </p>
              <a
                href="https://koryu.app/login"
                style={{
                  display: 'block',
                  background: GREEN,
                  color: '#fff',
                  textAlign: 'center',
                  padding: '16px',
                  borderRadius: 14,
                  fontSize: 16,
                  fontWeight: 700,
                  textDecoration: 'none',
                  marginBottom: 12,
                  boxShadow: '0 4px 20px rgba(22,163,74,0.35)',
                }}
              >
                Koryuで無料登録する
              </a>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                会社メール・個人メールどちらでも · すぐ使える
              </p>
            </div>
          </section>

        </div>
      </div>
    </>
  )
}
