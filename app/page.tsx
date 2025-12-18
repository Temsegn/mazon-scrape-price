import HeroCarousel from "@/components/HeroCarousel"
import Searchbar from "@/components/Searchbar"
import ProductFilter from "@/components/ProductFilter"
import BackgroundJobStarter from "@/components/BackgroundJobStarter"
import Image from "next/image"
import { getAllProducts } from "@/lib/actions"

type Props = {
  searchParams: { search?: string }
}

const Home = async ({ searchParams }: Props) => {
  const allProducts = await getAllProducts() || [];
  const initialSearch = searchParams?.search || '';

  return (
    <>
      <section className="px-6 md:px-20 py-24">
        <div className="flex max-xl:flex-col gap-16">
          <div className="flex flex-col justify-center"> 
            <p className="small-text">
              Smart Shopping Starts Here:
              <Image 
                src="/assets/icons/arrow-right.svg"
                alt="arrow-right"
                width={16}
                height={16}
              />
            </p>

            <h1 className="head-text">
              Unleash the Power of
              <span className="text-primary"> PriceWise</span>
            </h1>

            <p className="mt-6">
              Search stored products in the database. Background job continuously discovers and stores new products from Amazon.
            </p>

            <BackgroundJobStarter />
            <Searchbar />
          </div>

          <HeroCarousel />
        </div>
      </section>

      <section className="trending-section">
        <h2 className="section-text">Stored Products ({allProducts.length})</h2>

        <ProductFilter products={allProducts} initialSearch={initialSearch} />
      </section>
    </>
  )
}

export default Home