import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DonorGuidePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <Card className="border-[#1f5a2a]">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-4xl font-semibold text-[#065F46]">Zakat Guide</CardTitle>
            <Link href="/donor">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
          <div className="text-sm text-black/60">Learn what zakat is and how to calculate it.</div>
        </CardHeader>
        <CardContent className="space-y-6 text-black">
          <section className="space-y-2">
            <h2 className="text-2xl font-semibold text-[#065F46]">Waa maxay Zakadu?</h2>
            <p className="text-sm text-black/80">Zakadu waa waajib Islaami ah oo ku waajib ah qof kasta oo Muslim ah oo haysta hanti gaartay Nisaab.</p>
            <p className="text-sm text-black/80">Waxay ka mid tahay Shanta Tiir ee Islaamka.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold text-[#065F46]">Daliil Qur’aan</h2>
            <div className="rounded-lg bg-black/[0.03] p-4">
              <div className="text-lg font-semibold text-black">خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً تُطَهِّرُهُمْ وَتُزَكِّيهِمْ بِهَا</div>
              <div className="mt-3 text-sm text-black/80">Fasiraad (Somali): Ka qaad zakada hantidooda si aad ugu nadiifiso una daahiriso, oo aad ugu barakaysid.</div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold text-[#065F46]">Daliil Xadiis</h2>
            <div className="rounded-lg bg-black/[0.03] p-4">
              <p className="text-sm text-black/80">
                Prophet Muhammad ﷺ wuxuu yiri: “Islaamka waxaa lagu dhisay shan…”
              </p>
              <p className="mt-2 text-sm text-black/80">(Waxaa ka mid ah bixinta zakada)</p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold text-[#065F46]">Yaa ku waajib ah Zakada?</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-black/80">
              <li>Muslim ah</li>
              <li>Hanti haysta</li>
              <li>Hantidu gaarto Nisaab</li>
              <li>Hantidu joogto 1 sano (Hawl)</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold text-[#065F46]">Waa maxay Nisaab?</h2>
            <p className="text-sm text-black/80">Nisaab waa xadka ugu yar ee hantida ee zakadu ku waajibto.</p>
            <p className="mt-2 text-sm text-black/80">Waxaa lagu saleeyaa Dahab (Gold): 85 garaam dahab.</p>
            <p className="mt-1 text-sm text-black/80">Nisaab = 85 × qiimaha dahabka halkii garaam</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold text-[#065F46]">Sidee loo xisaabiyaa Zakada?</h2>
            <p className="text-sm text-black/80">Zakadu waa 2.5% (1/40) ee hantida.</p>
            <div className="rounded-lg bg-black/[0.03] p-4 text-sm text-black/80">
              <div className="font-semibold text-black">Tusaale:</div>
              <div className="mt-2">Hanti = $10,000</div>
              <div>Zakada = $250</div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold text-[#065F46]">Noocyada Zakada</h2>

            <div className="rounded-lg border border-black/10 p-4 space-y-2">
              <div className="font-semibold text-black">1) Zakatul Maal (Hanti guud)</div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-black/80">
                <li>Lacagta (Cash)</li>
                <li>Bangiga ku jirta</li>
                <li>Dahab & lacag</li>
                <li>Kayd</li>
              </ul>
              <div className="text-sm text-black/80">
                Shuruud: Waa in ay gaarto Nisaab, Hal sano ay joogto.
              </div>
            </div>

            <div className="rounded-lg border border-black/10 p-4 space-y-2">
              <div className="font-semibold text-black">2) Zakatul Ganacsi</div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-black/80">
                <li>Ganacsatada: Qiimaha alaabta ganacsiga</li>
                <li>Lacagta iibka</li>
                <li>Faa’iidada</li>
              </ul>
              <div className="text-sm text-black/80">Zakada Ganacsi = (Hantida ganacsiga oo dhan) × 2.5%</div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold text-[#065F46]">Hantida Zakada laga bixin (Laga reebayo)</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-black/80">
              <li>Guriga aad degan tahay</li>
              <li>Baabuurka isticmaalka</li>
              <li>Dharka &amp; alaabta shaqsiga</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold text-[#065F46]">Yaa la siinayaa Zakada?</h2>
            <div className="rounded-lg bg-black/[0.03] p-4 space-y-2">
              <div className="text-sm text-black/70 font-semibold">Qur’aan 9:60</div>
              <div className="text-black">إِنَّمَا الصَّدَقَاتُ لِلْفُقَرَاءِ وَالْمَسَاكِينِ...</div>
              <div className="text-sm text-black/80">
                Fasiraad (Somali): Zakadu waxaa la siiyaa: Masaakiinta, Fuqarada, Shaqaalaha zakada, Qalbiyada la soo jiidayo, Addoomaha la xoraynayo, Deyn-bixinta, Jidka Allah, Socotada.
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold text-[#065F46]">Muhiimadda Zakada</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-black/80">
              <li>Nadiifisaa hantida</li>
              <li>Barakaysaa maalka</li>
              <li>Ka caawisaa bulshada</li>
              <li>Yareysa faqriga</li>
            </ul>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

