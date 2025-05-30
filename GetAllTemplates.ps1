<# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - #
	Find all drexel templates, sections, fields, including
		- data types:
			- branch templates
				- root item (template)
				- child items (template)
				- insert option templates
			- ordinary templates
				- base templates

	Output to:
		JSON

	Last Mod:  2025-04-25 08:42  adw337

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - #>

function GetAllTemplates {

	$outputFileName = "C:\inetpub\wwwroot\sc104.dev.local\sitecore\admin\reports\tv\allTemplates.json"

	$templatePaths = @(
		"master:/templates/Branches/Foundation",
		"master:/templates/Branches/Drexel",
		"master:/templates/Drexel",
		"master:/templates/Foundation"
	);

	#------------------------------------------------------------------------------------------------#

	$global:bigData = @()      # array of hash records
    $global:links = @() # array of template relationships
	$global:fieldTypes = @{}   # hash to capture all field type names

	## Step 1: fetch all drexel templates -- branch and regular

	$templateItems = @()

	foreach ($path in $templatePaths) {
		$templateItems += @(gci -PATH $path -RECURSE) |
			where {
				$_.Name -notlike '*Rendering Parameter' -AND (($_.TemplateName -EQ 'Template') -OR
				 ($_.TemplateName -EQ 'Branch'))
			}
	}

	## Step 2: process items -- find associated bits

	foreach ($ti in $templateItems) {
		if     ($ti.TemplateName -EQ 'Branch')   { GetData-BranchTemplate -ITEM $ti }
		elseif ($ti.TemplateName -EQ 'Template') { GetData-DataTemplate -ITEM $ti }
		else                                     { Write-Host "ERROR: $($ti.Paths.Fullpath)" }
	}

	## Step 3: remove links that point to parent nodes that we filtered out
    $dataWrapper = @{ 
        nodes = $global:bigData
        links = $global:links
    }

	foreach ($l in $dataWrapper.links) {
		$match = $dataWrapper.nodes | Where-Object { $_.id -EQ $l.source }
		if (-NOT $match) {
			Write-Host "removing link from $($l.source) to $($l.target)"
			$dataWrapper.links = $dataWrapper.links | Where-Object { $_.source -NE $l.source }
		}
	}

	##Step 4: Output to console and to logfile
	$dataOut = ConvertTo-Json -INPUTOBJECT $dataWrapper
	$textOut = "$($dataOut)"
	$textOut | Out-File $outputFileName -Encoding 'ascii'

	Write-Host "`nInventory of Template Field Types...`n"
	foreach ($k in ($global:fieldTypes.Keys | Sort)) {
		Write-Host $k
	}

	Write-Host "`nDone.`n`nOutput to $outputFileName"
}

function GetData-BranchTemplate {
	<#
		for branch templates, find these:
			- root item (the template)
			- all child items (their templates)
			- all insert option templates
	#>
	param( [Sitecore.Data.Items.Item]$item )

	$fullPath  = $item.Paths.Fullpath
	$outPath   = $fullPath -REPLACE "/sitecore/templates/", ""
	$queryPath = $fullPath -REPLACE "/sitecore", "master:"
	$bID       = $item.ID.Guid.ToString()
	$bName     = $item.Name

	$root     = gci -PATH $queryPath | Select -FIRST 1
	$rootName = "";
	$rootTID  = "";

	try {
		$rootTID = $root.Template.ID.Guid.ToString()
		$rootTemplateItem = gi "master:" -ID $rootTID
		$rootName = $rootTemplateItem.Name
	} catch {
		Write-Host "error with root item of $($item.Paths.Fullpath)..."
		Write-Host "roottid=$rootTID..."
	}

	$branchRecord = @{
		'name'     = $bName
		'type'     = "branch"
		'path'     = $outPath
		'id'       = $bID
		'rootName' = $rootName
		'rootId'   = $rootTID
	}
    $link = @{
        'source' = $rootTID
        'target' = $bID
    }
    $global:links += $link
	$global:bigData += $branchRecord
}

function GetData-DataTemplate {
	<#
		for regular templates, find these:
			- all base templates (except Standard Template)
	#>
	param( [Sitecore.Data.Items.Item]$item )

	$fullPath  = $item.Paths.Fullpath
	$outPath   = $fullPath -REPLACE "/sitecore/templates/", ""
	$queryPath = $fullPath -REPLACE "/sitecore", "master:"
	$tID       = $item.ID.Guid.ToString()
	$tName     = $item.Name

	if (-NOT ($icon = $item.__Icon)) { $icon = "defaultIcon" } 

	$templateRecord = @{
		'name' = $tName
		'type' = "template"
		'path' = $outPath
		'id'   = $tID
	}    
 
	$baseLinks = @();
	$titem = [Sitecore.Data.Items.TemplateItem]$item;
	foreach ($b in $titem.BaseTemplates) {
		if (($b.Name -NOTMATCH "Standard template") -AND
			($b.Name -NOTMATCH "Standard Rendering Parameters")) {
                $link = @{
                    'source' = $b.ID.Guid.ToString()
                    'target' = $tID
                }
                $baseLinks += $link
		}
	}

	$global:bigData += $templateRecord
    $global:links += $baseLinks
}

#----------------------------------------------------------------------------------------------------#

function Get-JsonHeader {
	$now = Get-Date -FORMAT "MMM dd, yyyy hh:mmtt"
	$text =
@"
/*
	- data compiled by GetAllTemplates.ps1
	- output to $outputFileName
	- copy me to "sitecoregold/build/Scripts/allTemplates.s"
	- $now
*/

function getTemplateMetaData() {
	let meta = {
		"lastupdate" : "$now",
		"compiledby" : "GetAllTemplates.ps1"
	};
	return meta;
}

function getTemplateData()
{
	let templateData =
"@

	return $text
}

function Get-JsonFooter {
	$text = ";`n`treturn templateData;`n};`n module.exports.getTemplateData = getTemplateData;`n module.exports.getTemplateMetaData = getTemplateMetaData;`n";
	
	return $text;
}

#----------------------------------------------------------------------------------------------------#

##
##  go...
##

GetAllTemplates
