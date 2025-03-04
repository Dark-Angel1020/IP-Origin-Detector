/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Upload, Globe, Download, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import Papa from "papaparse"

interface IPData {
  origin: string
  country: string
  loading: boolean
  error?: string
  blacklistStatus?: string // Added for blacklist status
}

interface CSVRow {
  origin: string
}

export default function IPSearchApp() {
  const [ipAddress, setIpAddress] = useState("")
  const [ipData, setIpData] = useState<IPData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [totalIPs, setTotalIPs] = useState(0)
  const [processedIPs, setProcessedIPs] = useState(0)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadFileName, setUploadFileName] = useState("")
  const [isProcessed, setIsProcessed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Function to check if an IP is blacklisted
  const checkBlacklist = async (ip: string): Promise<string> => {
    const blacklists = [
        "zen.spamhaus.org",
        "bl.spamcop.net",
        "b.barracudacentral.org",
        "access.redhawk.org",
        "all.s5h.net",
        "bl.tiopan.com",
        "blackholes.wirehub.net",
        "blacklist.sci.kun.nl",
        "block.dnsbl.sorbs.net",
        "blocked.hilli.dk",
        "bogons.cymru.com"
      ];      
    const reversedIp = ip.split(".").reverse().join(".")
    let blacklistStatus = "Not sure" // Default status

    try {
      const results = await Promise.all(
        blacklists.map(async (blacklist) => {
          const lookup = `${reversedIp}.${blacklist}`
          try {
            // Perform DNS lookup using a public DNS API
            const response = await fetch(`https://dns.google/resolve?name=${lookup}&type=A`)
            const data = await response.json()
            if (data.Answer && data.Answer.length > 0) {
              return `${blacklist}` // IP is blacklisted in this list
            }
          } catch (err) {
            // Ignore errors (IP is not blacklisted in this list)
          }
          return null
        })
      )

      const blacklistedIn = results.filter((result) => result !== null)
      if (blacklistedIn.length > 0) {
        blacklistStatus = `Blacklisted in ${blacklistedIn.join(", ")}`
      } else {
        blacklistStatus = "Not blacklisted"
      }
    } catch (err) {
      console.error("Error checking blacklist:", err)
    }

    return blacklistStatus
  }

  const fetchIPLocation = async (ip: string): Promise<{ country: string; blacklistStatus: string } | { error: string }> => {
    try {
      const response = await fetch(`https://ipwho.is/${ip}`)
      const data = await response.json()

      if (data.success === false) {
        return { error: data.message || "Invalid IP address" }
      }

      // Perform blacklist check
      const blacklistStatus = await checkBlacklist(ip)

      return { country: data.country || "Unknown", blacklistStatus }
    } catch (err) {
      return { error: "Failed to fetch location data" }
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadFileName(file.name)
      setUploadError(null)

      Papa.parse<CSVRow>(file, {
        header: true,
        complete: (results) => {
          const origins = results.data
            .map((row) => row.origin)
            .filter((origin) => origin && typeof origin === "string" && origin.trim() !== "")

          if (origins.length === 0) {
            setUploadError("No valid IP addresses detected in the uploaded file")
            setIpData([])
            setUploadSuccess(false)
            if (fileInputRef.current) {
              fileInputRef.current.value = ""
            }
            return
          }

          const initialIPData = origins.map((origin) => ({
            origin,
            country: "",
            loading: false,
            blacklistStatus: "",
          }))

          setIpData(initialIPData)
          setUploadSuccess(true)
          setIsProcessed(false)

          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        },
        error: (err) => {
          console.error("Error parsing CSV:", err)
          setUploadError("Error parsing CSV file")
          setUploadSuccess(false)
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        },
      })
    }
  }

  const handleBulkUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleSearch = async () => {
    if (!ipAddress) return

    setIsLoading(true)
    setProgress(0)
    setTotalIPs(1)
    setProcessedIPs(0)
    setUploadSuccess(false)
    setUploadError(null)

    setIpData([{ origin: ipAddress, country: "", loading: true, blacklistStatus: "" }])

    try {
      const result = await fetchIPLocation(ipAddress)

      if ("error" in result) {
        setIpData([
          {
            origin: ipAddress,
            country: "",
            loading: false,
            error: result.error,
            blacklistStatus: "",
          },
        ])
      } else {
        setIpData([
          {
            origin: ipAddress,
            country: result.country,
            loading: false,
            blacklistStatus: result.blacklistStatus,
          },
        ])
      }

      setProcessedIPs(1)
      setProgress(100)
      setIsProcessed(true)
    } catch (err) {
      setIpData([
        {
          origin: ipAddress,
          country: "",
          loading: false,
          error: "Failed to fetch location data",
          blacklistStatus: "",
        },
      ])
      setIsProcessed(true)
    }

    setTimeout(() => {
      setIsLoading(false)
    }, 500)
  }

  const handleSubmit = async () => {
    if (ipData.length === 0) {
      if (ipAddress) {
        handleSearch()
      }
      return
    }

    setIsLoading(true)
    setProgress(0)
    setTotalIPs(ipData.length)
    setProcessedIPs(0)
    setUploadSuccess(false)
    setUploadError(null)

    setIpData((prevData) =>
      prevData.map((item) => ({
        ...item,
        loading: true,
        country: "",
        error: undefined,
        blacklistStatus: "",
      }))
    )

    for (let i = 0; i < ipData.length; i++) {
      const ip = ipData[i].origin

      try {
        const result = await fetchIPLocation(ip)

        setIpData((prevData) => {
          const newData = [...prevData]
          if ("error" in result) {
            newData[i] = {
              ...newData[i],
              loading: false,
              error: result.error,
              blacklistStatus: "",
            }
          } else {
            newData[i] = {
              ...newData[i],
              country: result.country,
              loading: false,
              blacklistStatus: result.blacklistStatus,
            }
          }
          return newData
        })
      } catch (err) {
        setIpData((prevData) => {
          const newData = [...prevData]
          newData[i] = {
            ...newData[i],
            loading: false,
            error: "Failed to fetch location data",
            blacklistStatus: "",
          }
          return newData
        })
      }

      setProcessedIPs(i + 1)
      setProgress(Math.round(((i + 1) / ipData.length) * 100))

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    setTimeout(() => {
      setIsLoading(false)
      setIsProcessed(true)
    }, 500)
  }

  const handleExport = () => {
    const csvData = ipData.map((item) => ({
      origin: item.origin,
      country: item.error ? item.error : item.country,
      blacklistStatus: item.blacklistStatus || "Not sure",
    }))

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", "ip_geolocation_data.csv")
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleReset = () => {
    setIpAddress("")
    setIpData([])
    setUploadSuccess(false)
    setUploadError(null)
    setUploadFileName("")
    setProgress(0)
    setTotalIPs(0)
    setProcessedIPs(0)
    setIsProcessed(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 min-h-screen dark:from-gray-900 dark:to-blue-950 flex items-center justify-center">
      <Card className="w-full max-w-4xl shadow-lg border-t-4 border-t-blue-500">
        <CardHeader className="dark:bg-gray-800 rounded-t-lg">
          <CardTitle className="text-2xl flex items-center gap-2 text-blue-700">
            <Globe className="h-6 w-6 text-blue-500" />
            IP Geolocation Lookup Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="IP Address"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="flex-1 border-blue-200 focus:border-blue-500 dark:border-blue-900 dark:focus:border-blue-500"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleSearch}
                disabled={isLoading || !ipAddress}
                className="border-blue-200 hover:bg-blue-100 hover:text-blue-700 dark:border-blue-800 dark:hover:bg-blue-900"
              >
                <Search className="h-4 w-4" />
                <span className="sr-only">Search</span>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <Button
                variant="outline"
                onClick={handleBulkUploadClick}
                disabled={isLoading}
                className="border-blue-200 hover:bg-blue-500 hover:text-white dark:border-blue-800 dark:hover:bg-blue-600"
              >
                <Upload className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={isLoading || ipData.length === 0}
                className="border-blue-200 hover:bg-blue-500 hover:text-white dark:border-blue-800 dark:hover:bg-blue-600"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="border-red-200 hover:bg-red-500 hover:text-white dark:border-red-800 dark:hover:bg-red-600"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          {uploadSuccess && (
            <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="flex items-center justify-between">
                <span>File uploaded successfully: <span className="font-semibold">{uploadFileName}</span> ({ipData.length} IPs detected)</span>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-700">
                  Ready to process
                </Badge>
              </AlertDescription>
            </Alert>
          )}

          {uploadError && (
            <Alert className="bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription>
                {uploadError}
              </AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-blue-700 dark:text-blue-300">
                  Processing {processedIPs}/{totalIPs} IPs
                </span>
                <span className="font-semibold text-blue-700 dark:text-blue-300">{progress}%</span>
              </div>
              <Progress
                value={progress}
                className="h-2 w-full [&>div]:bg-blue-500 bg-blue-100 dark:bg-blue-900 dark:[&>div]:bg-blue-400"
              />
            </div>
          )}

          {ipData.length > 0 && isProcessed && !isLoading && (
            <div className="border rounded-md overflow-hidden shadow-sm border-blue-200 dark:border-blue-900">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50 dark:bg-blue-950">
                    <TableHead className="w-1/3 font-semibold text-blue-700 dark:text-blue-300">Origin</TableHead>
                    <TableHead className="w-1/3 font-semibold text-blue-700 dark:text-blue-300">Country</TableHead>
                    <TableHead className="w-1/3 font-semibold text-blue-700 dark:text-blue-300">Blacklist Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ipData.map((item, index) => (
                    <TableRow key={index} className="hover:bg-blue-50/50 transition-colors dark:hover:bg-blue-900/20">
                      <TableCell className="font-mono">{item.origin}</TableCell>
                      <TableCell>
                        {item.loading ? (
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                            <span>Loading...</span>
                          </div>
                        ) : item.error ? (
                          <span className="text-red-500 dark:text-red-400">{item.error}</span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{item.country || "Unknown"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.blacklistStatus === "Not blacklisted" ? (
                          <span className="text-green-600 dark:text-green-400">Not blacklisted</span>
                        ) : item.blacklistStatus?.startsWith("Blacklisted") ? (
                          <span className="text-red-600 dark:text-red-400">{item.blacklistStatus}</span>
                        ) : (
                          <span className="text-orange-600 dark:text-orange-400">Not sure</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <CardFooter className="dark:bg-gray-800 p-6 rounded-b-lg">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600 transition-all hover:shadow-md"
            onClick={handleSubmit}
            disabled={isLoading || (ipData.length === 0 && !ipAddress)}
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin"></div>
                Processing... ({progress}%)
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
